/**
 * @navic/gnss-core — Dilution of Precision (DOP) Calculator
 *
 * Computes HDOP, VDOP, PDOP, and GDOP from satellite line-of-sight geometry vectors.
 */

import { DilutionOfPrecision, SatelliteInfo } from '@navic/shared-models';

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

/**
 * 4x4 Matrix Inversion with Partial Pivoting
 */
function invert4x4(M: number[][]): number[][] | null {
  const aug: number[][] = new Array(4);
  for (let i = 0; i < 4; i++) {
    aug[i] = [
      M[i][0], M[i][1], M[i][2], M[i][3],
      i === 0 ? 1 : 0,
      i === 1 ? 1 : 0,
      i === 2 ? 1 : 0,
      i === 3 ? 1 : 0,
    ];
  }

  for (let col = 0; col < 4; col++) {
    // Find pivot
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let r = col + 1; r < 4; r++) {
      const val = Math.abs(aug[r][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = r;
      }
    }

    if (maxVal < 1e-9) {
      aug[col][col] += 1e-4; // Regularize near-singular geometry
    }

    if (maxRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = tmp;
    }

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) return null;

    for (let j = 0; j < 8; j++) {
      aug[col][j] /= pivot;
    }

    for (let r = 0; r < 4; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 8; j++) {
        aug[r][j] -= factor * aug[col][j];
      }
    }
  }

  const res: number[][] = new Array(4);
  for (let i = 0; i < 4; i++) {
    res[i] = [aug[i][4], aug[i][5], aug[i][6], aug[i][7]];
  }
  return res;
}
