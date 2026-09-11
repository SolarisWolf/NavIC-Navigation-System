/**
 * @navic/shared-models — Mathematical and Matrix Utilities
 *
 * Core mathematical primitives, angle normalization, and matrix inversion
 * shared across GNSS, sensor fusion, and navigation engines.
 */

/**
 * Normalizes an angle in radians to [-pi, pi] robustly using atan2.
 */
export function normalizeAngleRad(rad: number): number {
  let a = Math.atan2(Math.sin(rad), Math.cos(rad));
  if (Math.abs(a + Math.PI) < 1e-12) {
    a = Math.PI;
  }
  return a;
}

/**
 * Normalizes an angle in degrees to [0, 360).
 */
export function normalizeAngleDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/**
 * Inverts a square matrix using Gauss-Jordan elimination with partial pivoting.
 * Automatically adds regularization if near singular to prevent NaN.
 */
export function matrixInverse(A: number[][]): number[][] {
  const n = A.length;
  if (n === 0 || A[0].length !== n) {
    throw new Error('Matrix must be square to invert');
  }

  // Clone A and augment with identity matrix: [A | I]
  const aug: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    aug[i] = new Array(2 * n);
    for (let j = 0; j < n; j++) {
      aug[i][j] = A[i][j];
      aug[i][j + n] = i === j ? 1.0 : 0.0;
    }
  }

  // Gauss-Jordan elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot row
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(aug[r][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = r;
      }
    }

    if (maxVal < 1e-12) {
      // Near singular; add small regularization along diagonal to prevent NaN
      aug[col][col] += 1e-6;
    }

    // Swap pivot row if needed
    if (maxRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = tmp;
    }

    // Scale pivot row
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate other rows
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (Math.abs(factor) < 1e-15) continue;
      for (let j = 0; j < 2 * n; j++) {
        aug[r][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverted matrix from augmented right side
  const inv: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    inv[i] = new Array(n);
    for (let j = 0; j < n; j++) {
      inv[i][j] = aug[i][j + n];
    }
  }
  return inv;
}

/**
 * Specifically inverts a 4x4 matrix with partial pivoting and singularity detection.
 * Returns null if singular and unrecoverable.
 */
export function invert4x4(M: number[][]): number[][] | null {
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
