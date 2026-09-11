/**
 * @navic/gnss-core — Dilution of Precision (DOP) Calculator
 *
 * Computes HDOP, VDOP, PDOP, and GDOP from satellite line-of-sight geometry vectors.
 */

import { DilutionOfPrecision, SatelliteInfo, invert4x4 } from '@navic/shared-models';

/**
 * Computes DOP metrics from satellites used in the current navigation fix.
 */
export function calculateDOP(satellites: readonly SatelliteInfo[]): DilutionOfPrecision {
  const used = satellites.filter((s) => s.usedInFix);

  // At least 4 satellites with non-coplanar geometry are required for 3D DOP
  if (used.length < 4) {
    return {
      hdop: 99.9,
      vdop: 99.9,
      pdop: 99.9,
      gdop: 99.9,
    };
  }

  // Construct N x 4 design matrix A
  // A[i] = [cos(el)*sin(az), cos(el)*cos(az), sin(el), 1]
  const n = used.length;
  const A: number[][] = new Array(n);

  for (let i = 0; i < n; i++) {
    const s = used[i];
    const azRad = (s.azimuth * Math.PI) / 180.0;
    const elRad = (s.elevation * Math.PI) / 180.0;

    const cosEl = Math.cos(elRad);
    A[i] = [
      cosEl * Math.sin(azRad), // East
      cosEl * Math.cos(azRad), // North
      Math.sin(elRad),         // Up
      1.0,                     // Receiver clock bias
    ];
  }

  // Compute normal matrix M = A^T * A (4 x 4)
  const M: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[k][r] * A[k][c];
      }
      M[r][c] = sum;
    }
  }

  // Invert 4x4 matrix M using Gauss-Jordan elimination
  const inv = invert4x4(M);
  if (!inv) {
    return {
      hdop: 50.0,
      vdop: 50.0,
      pdop: 50.0,
      gdop: 50.0,
    };
  }

  const qE = Math.max(0, inv[0][0]);
  const qN = Math.max(0, inv[1][1]);
  const qU = Math.max(0, inv[2][2]);
  const qT = Math.max(0, inv[3][3]);

  const hdop = Math.min(99.9, Math.sqrt(qE + qN));
  const vdop = Math.min(99.9, Math.sqrt(qU));
  const pdop = Math.min(99.9, Math.sqrt(qE + qN + qU));
  const gdop = Math.min(99.9, Math.sqrt(qE + qN + qU + qT));

  return {
    hdop: Number(hdop.toFixed(2)),
    vdop: Number(vdop.toFixed(2)),
    pdop: Number(pdop.toFixed(2)),
    gdop: Number(gdop.toFixed(2)),
  };
}

