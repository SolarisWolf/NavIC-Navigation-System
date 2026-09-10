package com.navic.navigation

import android.Manifest
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
import androidx.webkit.WebViewAssetLoader
import com.navic.navigation.bridge.NavICNativeBridge
import com.navic.navigation.databinding.ActivityMainBinding
import com.navic.navigation.service.NavigationForegroundService

/**
 * Main Activity hosting the offline NavIC navigation interface inside a
 * hardware-accelerated local WebView container with native sensor bridge.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var bridge: NavICNativeBridge
    private var isWakeLockActive = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocation = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseLocation = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false

        if (fineLocation || coarseLocation) {
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

        // Request Location Permissions
        requestRequiredPermissions()

        // Setup Native Bridge
        setupNativeBridge()

        // Setup Hardware-Accelerated WebView
        setupWebView()

        // Setup Back Press Navigation
        setupBackNavigation()
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
            onNotificationUpdate = { maneuver, stats ->
                NavigationForegroundService.updateService(this, maneuver, stats)
            },
            onStopGuidanceRequested = {
                NavigationForegroundService.stopService(this)
            }
        )
    }

    private fun setupWebView() {
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

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    binding.loadingIndicator.visibility = View.GONE
                }
            }

            // Load local bundled web application via HTTPS asset domain
            loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        NavigationForegroundService.stopService(this)
        if (isWakeLockActive) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        binding.webView.destroy()
    }
}
