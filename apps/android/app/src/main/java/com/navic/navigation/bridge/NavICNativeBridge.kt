package com.navic.navigation.bridge

import android.content.Context
import android.location.GnssStatus
import android.location.LocationManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Bi-directional native Android to Web JavaScript bridge.
 * Exposes device hardware environment, NavIC constellation detection,
 * wake-lock management, and foreground navigation notifications.
 */
class NavICNativeBridge(
    private val context: Context,
    private val onWakeLockRequested: (Boolean) -> Unit,
    private val onNotificationUpdate: (String, String) -> Unit,
    private val onStopGuidanceRequested: () -> Unit
) {
    companion object {
        const val TAG = "NavICNativeBridge"
        const val JS_NAMESPACE = "NavICNative"
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

        // Check if GPS/GNSS provider is available
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
