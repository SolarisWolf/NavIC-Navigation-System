package com.navic.navigation.sensors

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.util.Log
import org.json.JSONObject

/**
 * Native Android Battery & Power monitor.
 * Listens to system battery broadcast events and extracts charge percentage,
 * charging status/source, battery temperature, voltage, and health metrics.
 */
class AndroidBatteryMonitor(
    private val context: Context,
    private val onBatteryUpdate: (String) -> Unit
) {
    companion object {
        private const val TAG = "AndroidBatteryMonitor"
    }

    private var isRegistered = false
    private var lastBatteryJson: String = "{}"

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == Intent.ACTION_BATTERY_CHANGED) {
                processBatteryIntent(intent)
            }
        }
    }

    fun start(): Boolean {
        if (isRegistered) return true
        try {
            val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            val stickyIntent = context.registerReceiver(batteryReceiver, filter)
            isRegistered = true

            // Process immediate sticky battery status
            if (stickyIntent != null) {
                processBatteryIntent(stickyIntent)
            }
            Log.i(TAG, "Battery monitoring started")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register battery receiver", e)
            return false
        }
    }

    fun stop() {
        if (!isRegistered) return
        try {
            context.unregisterReceiver(batteryReceiver)
            isRegistered = false
            Log.i(TAG, "Battery monitoring stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering battery receiver", e)
        }
    }

    fun getLatestBatteryStatus(): String {
        return lastBatteryJson
    }

    private fun processBatteryIntent(intent: Intent) {
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        val percent = if (level >= 0 && scale > 0) Math.round((level * 100.0f) / scale) else 100

        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL

        val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)
        val source = when (plugged) {
            BatteryManager.BATTERY_PLUGGED_AC -> "AC"
            BatteryManager.BATTERY_PLUGGED_USB -> "USB"
            BatteryManager.BATTERY_PLUGGED_WIRELESS -> "WIRELESS"
            else -> "UNKNOWN"
        }

        val temperatureTenths = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0)
        val temperatureCelsius = Math.round((temperatureTenths / 10.0f) * 10.0f) / 10.0f

        val voltageMv = intent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0)

        val healthCode = intent.getIntExtra(BatteryManager.EXTRA_HEALTH, BatteryManager.BATTERY_HEALTH_UNKNOWN)
        val health = when (healthCode) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "GOOD"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "OVERHEAT"
            BatteryManager.BATTERY_HEALTH_DEAD, BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "DEGRADED"
            else -> "GOOD"
        }

        val burnRate = if (isCharging) 0.0f else 15.0f
        val estimatedHours = if (isCharging) 99.0f else Math.round((percent / burnRate) * 10.0f) / 10.0f

        val json = JSONObject().apply {
            put("levelPercent", percent)
            put("isCharging", isCharging)
            put("chargingSource", source)
            put("temperatureCelsius", temperatureCelsius)
            put("voltageMv", voltageMv)
            put("health", health)
            put("estimatedHoursRemaining", estimatedHours)
        }

        lastBatteryJson = json.toString()
        onBatteryUpdate(lastBatteryJson)
    }
}
