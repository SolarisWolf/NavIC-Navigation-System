package com.navic.navigation

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import com.navic.navigation.bridge.NavICNativeBridge
import com.navic.navigation.databinding.ActivityMainBinding
import com.navic.navigation.service.NavigationForegroundService

/**
 * Main Activity hosting the offline NavIC navigation interface inside a
 * hardware-accelerated local WebView container with native sensor bridge,
 * geo intent deep linking, sticky immersive driving mode, and audio focus.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var bridge: NavICNativeBridge
    private var isWakeLockActive = false
    private var isPageLoaded = false
    private var pendingGeoIntentUri: String? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocation = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseLocation = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false

        if (fineLocation || coarseLocation) {
            bridge.startHardwareSensors()
            // Permissions granted; notify WebView
            binding.webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('android-permissions-granted'));",
                null
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Setup Native Bridge first
        setupNativeBridge()

        // Parse any incoming Geo URI launch intent
        handleIntent(intent)

        // Request Location Permissions and auto-start sensors
        requestRequiredPermissions()

        // Setup Hardware-Accelerated WebView
        setupWebView()

        // Setup Back Press Navigation
        setupBackNavigation()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        if (intent?.action == Intent.ACTION_VIEW && intent.data != null) {
            val uriString = intent.data.toString()
            pendingGeoIntentUri = uriString
            if (isPageLoaded) {
                dispatchGeoIntent(uriString)
            }
        }
    }

    private fun dispatchGeoIntent(uriString: String) {
        val escaped = uriString.replace("'", "\\'")
        val script = "window.dispatchEvent(new CustomEvent('android-geo-intent', { detail: { uri: '$escaped' } }));"
        runOnUiThread {
            binding.webView.evaluateJavascript(script, null)
        }
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val needsRequest = permissions.any {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needsRequest) {
            permissionLauncher.launch(permissions.toTypedArray())
        } else {
            // Already granted: start hardware sensors immediately
            bridge.startHardwareSensors()
        }
    }

    private fun setupNativeBridge() {
        bridge = NavICNativeBridge(
            context = this,
            onWakeLockRequested = { enable ->
                runOnUiThread {
                    if (enable && !isWakeLockActive) {
                        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        isWakeLockActive = true
                    } else if (!enable && isWakeLockActive) {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        isWakeLockActive = false
                    }
                }
            },
            onImmersiveModeRequested = { enable ->
                setImmersiveDrivingMode(enable)
            },
            onNotificationUpdate = { maneuver, stats ->
                NavigationForegroundService.updateService(this, maneuver, stats)
            },
            onStopGuidanceRequested = {
                NavigationForegroundService.stopService(this)
            },
            onGetPendingGeoIntent = {
                pendingGeoIntentUri
            },
            onDispatchJs = { jsScript ->
                runOnUiThread {
                    binding.webView.evaluateJavascript(jsScript, null)
                }
            }
        )
    }

    /**
     * Toggles edge-to-edge sticky immersive mode for distraction-free navigation.
     */
    fun setImmersiveDrivingMode(enable: Boolean) {
        runOnUiThread {
            val controller = WindowInsetsControllerCompat(window, window.decorView)
            if (enable) {
                controller.hide(WindowInsetsCompat.Type.systemBars())
                controller.systemBarsBehavior =
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }

    private fun setupWebView() {
        WebView.setWebContentsDebuggingEnabled(true)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        binding.webView.apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                allowFileAccess = false
                allowContentAccess = false
                displayZoomControls = false
                builtInZoomControls = false
                setSupportZoom(false)
            }

            // Register Native JavaScript Bridge
            addJavascriptInterface(bridge, NavICNativeBridge.JS_NAMESPACE)

            webChromeClient = object : android.webkit.WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                    consoleMessage?.let { msg ->
                        val tag = "NavIC-WebConsole"
                        val text = "${msg.message()} (line ${msg.lineNumber()} of ${msg.sourceId()})"
                        when (msg.messageLevel()) {
                            android.webkit.ConsoleMessage.MessageLevel.ERROR -> android.util.Log.e(tag, text)
                            android.webkit.ConsoleMessage.MessageLevel.WARNING -> android.util.Log.w(tag, text)
                            else -> android.util.Log.i(tag, text)
                        }
                    }
                    return true
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                    android.util.Log.e("NavIC-WebView", "Render process gone (crashed: ${detail.didCrash()}) - attempting auto-recovery")
                    isPageLoaded = false
                    binding.loadingIndicator.visibility = View.VISIBLE
                    view.post {
                        view.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
                    }
                    return true // Return true to indicate crash handled
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: android.webkit.WebResourceError
                ) {
                    super.onReceivedError(view, request, error)
                    if (request.isForMainFrame) {
                        android.util.Log.e("NavIC-WebView", "Main frame load error: ${error.description}")
                    }
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    binding.loadingIndicator.visibility = View.GONE
                    isPageLoaded = true
                    bridge.startHardwareSensors()
                    view.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('android-permissions-granted'));",
                        null
                    )
                    pendingGeoIntentUri?.let { uri ->
                        dispatchGeoIntent(uri)
                    }
                }
            }

            // Load local bundled web application via HTTPS asset domain
            loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Dispatch back-press event to Web client for confirmation or screen pop
                binding.webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('android-back-pressed'));",
                    null
                )
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::bridge.isInitialized) {
            bridge.stopHardwareSensors()
        }
        NavigationForegroundService.stopService(this)
        if (isWakeLockActive) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        binding.webView.destroy()
    }
}
