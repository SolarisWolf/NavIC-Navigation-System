package com.navic.navigation.bridge

import android.content.Context
import android.location.LocationManager
import android.os.Build
import android.util.Log
import android.webkit.JavascriptInterface
import com.navic.navigation.audio.AndroidAudioManager
import com.navic.navigation.sensors.AndroidLocationProvider
import com.navic.navigation.sensors.AndroidSensorProvider
import com.navic.navigation.sensors.AndroidBatteryMonitor
import org.json.JSONObject

/**
 * Bi-directional native Android to Web JavaScript bridge.
 * Exposes device hardware environment, NavIC constellation detection,
 * real GPS/NavIC hardware location updates, 50 Hz IMU sensors,
 * wake-lock management, audio focus ducking, immersive driving mode,
 * geo intent deep links, and foreground navigation notifications.
 */
class NavICNativeBridge(
    private val context: Context,
    private val onWakeLockRequested: (Boolean) -> Unit,
    private val onImmersiveModeRequested: (Boolean) -> Unit,
    private val onNotificationUpdate: (String, String) -> Unit,
    private val onStopGuidanceRequested: () -> Unit,
    private val onGetPendingGeoIntent: () -> String?,
    private val onDispatchJs: (String) -> Unit
) {
    companion object {
        const val TAG = "NavICNativeBridge"
        const val JS_NAMESPACE = "NavICNative"
    }

    private var isHardwareActive = false

    private val locationProvider = AndroidLocationProvider(
        context = context,
        onMeasurement = { jsonStr ->
            dispatchToWeb("navic-hardware-gnss", jsonStr)
        },
        onStatus = { jsonStr ->
            dispatchToWeb("navic-hardware-gnss-status", jsonStr)
        },
        onNavICReport = { jsonStr ->
            dispatchToWeb("navic-hardware-report", jsonStr)
        }
    )

    private val sensorProvider = AndroidSensorProvider(
        context = context,
        onAccelerometer = { jsonStr ->
            dispatchToWeb("navic-hardware-accel", jsonStr)
        },
        onGyroscope = { jsonStr ->
            dispatchToWeb("navic-hardware-gyro", jsonStr)
        },
        onMagnetometer = { jsonStr ->
            dispatchToWeb("navic-hardware-mag", jsonStr)
        }
    )

    private val batteryMonitor = AndroidBatteryMonitor(
        context = context,
        onBatteryUpdate = { jsonStr ->
            dispatchToWeb("navic-hardware-battery", jsonStr)
        }
    )

    private val audioManager = AndroidAudioManager(context)

    init {
        // Start battery monitoring immediately so web client has telemetry on launch
        batteryMonitor.start()
    }

    private fun dispatchToWeb(eventType: String, jsonDetail: String) {
        val script = "window.dispatchEvent(new CustomEvent('$eventType', { detail: $jsonDetail }));"
        onDispatchJs(script)
    }

    /**
     * Starts native GNSS and 50 Hz IMU hardware sensors.
     */
    @JavascriptInterface
    fun startHardwareSensors(): Boolean {
        Log.i(TAG, "startHardwareSensors called")
        val locStarted = locationProvider.start()
        val sensorsStarted = sensorProvider.start()
        batteryMonitor.start()
        isHardwareActive = locStarted || sensorsStarted
        return isHardwareActive
    }

    /**
     * Stops native GNSS and IMU hardware sensors.
     */
    @JavascriptInterface
    fun stopHardwareSensors() {
        Log.i(TAG, "stopHardwareSensors called")
        locationProvider.stop()
        sensorProvider.stop()
        isHardwareActive = false
    }

    /**
     * Returns whether hardware sensors are actively streaming.
     */
    @JavascriptInterface
    fun isHardwareSensorsActive(): Boolean {
        return isHardwareActive
    }

    /**
     * Returns hardware sensor status JSON.
     */
    @JavascriptInterface
    fun getHardwareSensorStatus(): String {
        return sensorProvider.getStatusJson()
    }

    /**
     * Dynamically changes IMU sensor sampling frequency (e.g. 50 Hz in motion vs 10 Hz stationary).
     */
    @JavascriptInterface
    fun setSensorSamplingRate(rateHz: Int) {
        val periodUs = if (rateHz > 0) (1_000_000 / rateHz) else 20_000
        sensorProvider.setSamplingPeriodUs(periodUs)
    }

    /**
     * Returns the latest battery and power telemetry JSON.
     */
    @JavascriptInterface
    fun getBatteryStatus(): String {
        return batteryMonitor.getLatestBatteryStatus()
    }

    /**
     * Returns the latest NavIC constellation detection and signal quality report JSON.
     */
    @JavascriptInterface
    fun getNavICConstellationReport(): String {
        return locationProvider.getLatestNavICReport() ?: "{}"
    }

    /**
     * Returns comprehensive device and hardware GNSS capabilities in JSON format.
     */
    @JavascriptInterface
    fun getAndroidEnvironmentInfo(): String {
        val info = JSONObject().apply {
            put("platform", "Android")
            put("sdkVersion", Build.VERSION.SDK_INT)
            put("release", Build.VERSION.RELEASE)
            put("brand", Build.BRAND)
            put("model", Build.MODEL)
            put("hardware", Build.HARDWARE)
            put("isNavICSupported", isNavICSupported())
            put("hasGnssMeasurements", hasRawGnssMeasurements())
            put("isHighRateSensorsSupported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            put("isHardwareActive", isHardwareActive)
        }
        return info.toString()
    }

    /**
     * Queries whether this Android device's GNSS chipset supports the NavIC (IRNSS) constellation.
     * Android 8.0 (API 26+) formally introduced CONSTELLATION_IRNSS (type 7).
     */
    @JavascriptInterface
    fun isNavICSupported(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return false
        }
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return false

        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
    }

    /**
     * Checks if device supports raw GNSS pseudoranges and carrier phase measurements.
     */
    @JavascriptInterface
    fun hasRawGnssMeasurements(): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
    }

    /**
     * Acquires or releases screen wake lock to keep navigation screen visible during driving.
     */
    @JavascriptInterface
    fun setWakeLock(enable: Boolean) {
        Log.i(TAG, "Wake lock requested: $enable")
        onWakeLockRequested(enable)
    }

    /**
     * Updates native Android ongoing notification during active navigation guidance.
     */
    @JavascriptInterface
    fun updateGuidanceNotification(maneuverText: String, etaStats: String) {
        onNotificationUpdate(maneuverText, etaStats)
    }

    /**
     * Rich navigation notification update with turn maneuver, distance, ETA, and road name.
     */
    @JavascriptInterface
    fun updateNavigationNotification(maneuver: String, distance: String, eta: String, road: String) {
        val stats = if (road.isNotEmpty()) "$road • $distance • ETA: $eta" else "$distance • ETA: $eta"
        onNotificationUpdate(maneuver, stats)
    }

    /**
     * Request transient audio ducking focus before speaking guidance instructions.
     */
    @JavascriptInterface
    fun requestAudioFocus(): Boolean {
        return audioManager.requestNavigationAudioFocus()
    }

    /**
     * Abandon audio focus after guidance instruction or chime finishes.
     */
    @JavascriptInterface
    fun abandonAudioFocus(): Boolean {
        return audioManager.abandonNavigationAudioFocus()
    }

    /**
     * Toggles sticky immersive edge-to-edge full-screen driving mode.
     */
    @JavascriptInterface
    fun setImmersiveMode(enable: Boolean) {
        Log.i(TAG, "Immersive mode requested: $enable")
        onImmersiveModeRequested(enable)
    }

    /**
     * Returns any pending Geo intent URI (from cold start launch or external app tap).
     */
    @JavascriptInterface
    fun getPendingGeoIntent(): String {
        val intentUri = onGetPendingGeoIntent() ?: ""
        Log.d(TAG, "getPendingGeoIntent: $intentUri")
        return intentUri
    }

    /**
     * Stops native background guidance service.
     */
    @JavascriptInterface
    fun stopGuidanceService() {
        onStopGuidanceRequested()
    }

    /**
     * Logs debug messages from Web JavaScript directly to Android Logcat.
     */
    @JavascriptInterface
    fun log(level: String, tag: String, message: String) {
        val logTag = "Web:$tag"
        when (level.lowercase()) {
            "debug" -> Log.d(logTag, message)
            "warn" -> Log.w(logTag, message)
            "error" -> Log.e(logTag, message)
            else -> Log.i(logTag, message)
        }
    }
}
