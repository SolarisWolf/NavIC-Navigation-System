/**
 * @navic/sensor-fusion — Matrix Operations
 *
 * Efficient, zero-dependency matrix math for Kalman Filter prediction
 * and measurement update calculations.
 */

export type Matrix = number[][];
export type Vector = number[];

/**
 * Creates an empty matrix filled with a constant value.
 */
export function createMatrix(rows: number, cols: number, fill = 0): Matrix {
  const m: Matrix = new Array(rows);
  for (let i = 0; i < rows; i++) {
    m[i] = new Array(cols).fill(fill);
  }
  return m;
}

/**
 * Creates an n x n identity matrix.
 */
export function identityMatrix(n: number): Matrix {
  const m = createMatrix(n, n, 0);
  for (let i = 0; i < n; i++) {
    m[i][i] = 1;
  }
  return m;
}

/**
 * Matrix addition: C = A + B
 */
export function matrixAdd(A: Matrix, B: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const C = createMatrix(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      C[i][j] = A[i][j] + B[i][j];
    }
  }
  return C;
}

/**
 * Matrix subtraction: C = A - B
 */
export function matrixSub(A: Matrix, B: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const C = createMatrix(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      C[i][j] = A[i][j] - B[i][j];
    }
  }
  return C;
}

/**
 * Matrix multiplication: C = A * B
 */
export function matrixMultiply(A: Matrix, B: Matrix): Matrix {
  const rowsA = A.length;
  const colsA = A[0].length;
  const rowsB = B.length;
  const colsB = B[0].length;

  if (colsA !== rowsB) {
    throw new Error(`Matrix dimension mismatch: (${rowsA}x${colsA}) * (${rowsB}x${colsB})`);
  }

  const C = createMatrix(rowsA, colsB, 0);
  for (let i = 0; i < rowsA; i++) {
    for (let k = 0; k < colsA; k++) {
      const a = A[i][k];
      if (a === 0) continue;
      for (let j = 0; j < colsB; j++) {
        C[i][j] += a * B[k][j];
      }
    }
  }
  return C;
}

/**
 * Matrix transpose: B = A^T
 */
export function matrixTranspose(A: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const B = createMatrix(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      B[j][i] = A[i][j];
    }
  }
  return B;
}

/**
 * Multiplies a matrix by a column vector: y = A * x
 */
export function matrixMultiplyVector(A: Matrix, x: Vector): Vector {
  const rows = A.length;
  const cols = A[0].length;
  if (cols !== x.length) {
    throw new Error(`Dimension mismatch: Matrix (${rows}x${cols}) * Vector (${x.length})`);
  }
  const y = new Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += A[i][j] * x[j];
    }
    y[i] = sum;
  }
  return y;
}

/**
 * Multiplies a matrix by a scalar: C = s * A
 */
export function matrixScale(A: Matrix, s: number): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const C = createMatrix(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      C[i][j] = A[i][j] * s;
    }
  }
  return C;
}

/**
 * Computes the inverse of a square matrix using Gauss-Jordan elimination with partial pivoting.
 */
export function matrixInverse(A: Matrix): Matrix {
  const n = A.length;
  if (n === 0 || A[0].length !== n) {
    throw new Error('Matrix must be square to invert');
  }

  // Clone A and augment with identity matrix
  const aug: Matrix = createMatrix(n, 2 * n, 0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      aug[i][j] = A[i][j];
    }
    aug[i][i + n] = 1.0;
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
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) {
        aug[r][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverted matrix from augmented right side
  const inv = createMatrix(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      inv[i][j] = aug[i][j + n];
    }
  }
  return inv;
}

/**
 * Normalizes an angle in radians to [-pi, pi]
 */
export function normalizeAngleRad(rad: number): number {
  let a = rad % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Normalizes an angle in degrees to [0, 360)
 */
export function normalizeAngleDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}
