package com.navic.navigation.sensors

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.GnssStatus
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native Android GNSS location and satellite tracking provider.
 * Interacts directly with LocationManager GPS_PROVIDER and GnssStatus callbacks
 * to stream real hardware position fixes and NavIC (IRNSS) constellation status.
 */
class AndroidLocationProvider(
    private val context: Context,
    private val onMeasurement: (String) -> Unit,
    private val onStatus: (String) -> Unit
) : LocationListener {

    companion object {
        private const val TAG = "AndroidLocationProvider"
    }

    private val locationManager: LocationManager? =
        context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

    private var isTracking = false
    private var gnssStatusCallback: GnssStatus.Callback? = null
    private var cachedSatellites = JSONArray()

    init {
        setupGnssStatusCallback()
    }

    private fun setupGnssStatusCallback() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            gnssStatusCallback = object : GnssStatus.Callback() {
                override fun onSatelliteStatusChanged(status: GnssStatus) {
                    val satArray = JSONArray()
                    var navicCount = 0
                    var usedCount = 0

                    for (i in 0 until status.satelliteCount) {
                        val constellationType = status.getConstellationType(i)
                        val constellationStr = when (constellationType) {
                            GnssStatus.CONSTELLATION_IRNSS -> {
                                navicCount++
                                "navic"
                            }
                            GnssStatus.CONSTELLATION_GPS -> "gps"
                            GnssStatus.CONSTELLATION_GALILEO -> "galileo"
                            GnssStatus.CONSTELLATION_BEIDOU -> "beidou"
                            GnssStatus.CONSTELLATION_GLONASS -> "glonass"
                            else -> "unknown"
                        }

                        val used = status.usedInFix(i)
                        if (used) usedCount++

                        val sat = JSONObject().apply {
                            put("id", "${constellationStr.uppercase()}-${status.getSvid(i)}")
                            put("prn", status.getSvid(i))
                            put("constellation", constellationStr)
                            put("snr", status.getCn0DbHz(i).toDouble())
                            put("elevation", status.getElevationDegrees(i).toDouble())
                            put("azimuth", status.getAzimuthDegrees(i).toDouble())
                            put("usedInFix", used)
                        }
                        satArray.put(sat)
                    }

                    cachedSatellites = satArray

                    val statusJson = JSONObject().apply {
                        put("totalSatellites", status.satelliteCount)
                        put("usedInFix", usedCount)
                        put("navicSatellites", navicCount)
                        put("isNavICDetected", navicCount > 0)
                    }
                    onStatus(statusJson.toString())
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun start(): Boolean {
        if (isTracking) return true

        val hasFine = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFine) {
            Log.w(TAG, "ACCESS_FINE_LOCATION not granted; cannot start native GNSS")
            return false
        }

        val lm = locationManager ?: return false

        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    1000L,
                    0f,
                    this
                )
            } else if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    1000L,
                    0f,
                    this
                )
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && gnssStatusCallback != null) {
                lm.registerGnssStatusCallback(gnssStatusCallback!!)
            }

            isTracking = true
            Log.i(TAG, "Native GNSS tracking started")
            return true
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException starting location updates", e)
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Error starting location updates", e)
            return false
        }
    }

    fun stop() {
        if (!isTracking) return
        val lm = locationManager ?: return

        try {
            lm.removeUpdates(this)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && gnssStatusCallback != null) {
                lm.unregisterGnssStatusCallback(gnssStatusCallback!!)
            }
            isTracking = false
            Log.i(TAG, "Native GNSS tracking stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping location updates", e)
        }
    }

    override fun onLocationChanged(location: Location) {
        val isMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }

        val vertAcc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasVerticalAccuracy()) {
            location.verticalAccuracyMeters.toDouble()
        } else {
            if (location.hasAccuracy()) location.accuracy.toDouble() * 1.5 else 8.0
        }

        val fixTypeStr = if (cachedSatellites.length() >= 4 && location.hasAltitude()) "3d" else "2d"

        val measurement = JSONObject().apply {
            put("timestamp", location.time)
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("altitude", if (location.hasAltitude()) location.altitude else 0.0)
            put("speed", if (location.hasSpeed()) location.speed.toDouble() else 0.0)
            put("bearing", if (location.hasBearing()) location.bearing.toDouble() else 0.0)
            put("horizontalAccuracy", if (location.hasAccuracy()) location.accuracy.toDouble() else 5.0)
            put("verticalAccuracy", vertAcc)
            put("fixType", fixTypeStr)
            put("satellites", cachedSatellites)
            put("isSimulated", isMock)
        }

        onMeasurement(measurement.toString())
    }

    override fun onProviderEnabled(provider: String) {
        Log.i(TAG, "Location provider enabled: $provider")
    }

    override fun onProviderDisabled(provider: String) {
        Log.w(TAG, "Location provider disabled: $provider")
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
}
