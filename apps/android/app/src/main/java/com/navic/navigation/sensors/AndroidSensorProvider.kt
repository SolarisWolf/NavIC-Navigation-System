package com.navic.navigation.sensors

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import org.json.JSONObject

/**
 * Native Android 50 Hz IMU sensor provider.
 * Streams real hardware accelerometer, gyroscope, and magnetometer readings
 * to feed the 7-state Extended Kalman Filter (EKF) sensor fusion engine.
 */
class AndroidSensorProvider(
    context: Context,
    private val onAccelerometer: (String) -> Unit,
    private val onGyroscope: (String) -> Unit,
    private val onMagnetometer: (String) -> Unit
) : SensorEventListener {

    companion object {
        private const val TAG = "AndroidSensorProvider"
        // 20,000 microseconds = 50 Hz
        private const val SENSOR_SAMPLING_PERIOD_US = 20_000
    }

    private val sensorManager: SensorManager? =
        context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

    private val accelerometer: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val gyroscope: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    private val magnetometer: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

    private var isRunning = false
    private var currentSamplingPeriodUs = SENSOR_SAMPLING_PERIOD_US

    fun start(): Boolean {
        if (isRunning) return true
        val sm = sensorManager ?: return false

        var registeredAny = false

        accelerometer?.let {
            val registered = sm.registerListener(this, it, currentSamplingPeriodUs)
            if (registered) registeredAny = true
        }

        gyroscope?.let {
            val registered = sm.registerListener(this, it, currentSamplingPeriodUs)
            if (registered) registeredAny = true
        }

        magnetometer?.let {
            val registered = sm.registerListener(this, it, currentSamplingPeriodUs)
            if (registered) registeredAny = true
        }

        isRunning = registeredAny
        Log.i(TAG, "Native IMU sensors started (isRunning=$isRunning, rateUs=$currentSamplingPeriodUs)")
        return isRunning
    }

    /**
     * Dynamically change sensor sampling rate without losing tracking state.
     * Useful for adaptive power throttling (e.g. 50 Hz in motion vs 10 Hz stationary).
     */
    fun setSamplingPeriodUs(periodUs: Int) {
        if (periodUs <= 0 || periodUs == currentSamplingPeriodUs) return
        currentSamplingPeriodUs = periodUs
        if (isRunning) {
            val sm = sensorManager ?: return
            sm.unregisterListener(this)
            accelerometer?.let { sm.registerListener(this, it, currentSamplingPeriodUs) }
            gyroscope?.let { sm.registerListener(this, it, currentSamplingPeriodUs) }
            magnetometer?.let { sm.registerListener(this, it, currentSamplingPeriodUs) }
            Log.i(TAG, "Sensor sampling period dynamically updated to ${currentSamplingPeriodUs}us (~${1_000_000 / currentSamplingPeriodUs}Hz)")
        }
    }

    fun stop() {
        if (!isRunning) return
        sensorManager?.unregisterListener(this)
        isRunning = false
        Log.i(TAG, "Native IMU sensors stopped")
    }

    fun getStatusJson(): String {
        return JSONObject().apply {
            put("isActive", isRunning)
            put("hasAccelerometer", accelerometer != null)
            put("hasGyroscope", gyroscope != null)
            put("hasMagnetometer", magnetometer != null)
            put("sampleRateHz", 50)
            put("isSimulated", false)
        }.toString()
    }

    override fun onSensorChanged(event: SensorEvent) {
        val now = System.currentTimeMillis()
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                val accelJson = JSONObject().apply {
                    put("timestamp", now)
                    put("acceleration", JSONObject().apply {
                        put("x", event.values[0].toDouble())
                        put("y", event.values[1].toDouble())
                        put("z", event.values[2].toDouble())
                    })
                    put("isSimulated", false)
                }
                onAccelerometer(accelJson.toString())
            }

            Sensor.TYPE_GYROSCOPE -> {
                val gyroJson = JSONObject().apply {
                    put("timestamp", now)
                    put("angularVelocity", JSONObject().apply {
                        put("x", event.values[0].toDouble())
                        put("y", event.values[1].toDouble())
                        put("z", event.values[2].toDouble())
                    })
                    put("isSimulated", false)
                }
                onGyroscope(gyroJson.toString())
            }

            Sensor.TYPE_MAGNETIC_FIELD -> {
                val magJson = JSONObject().apply {
                    put("timestamp", now)
                    put("magneticField", JSONObject().apply {
                        put("x", event.values[0].toDouble())
                        put("y", event.values[1].toDouble())
                        put("z", event.values[2].toDouble())
                    })
                    put("isSimulated", false)
                }
                onMagnetometer(magJson.toString())
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Sensor accuracy state changed (e.g. calibration status)
    }
}
