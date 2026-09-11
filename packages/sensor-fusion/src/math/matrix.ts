/**
 * @navic/sensor-fusion — Matrix Operations
 *
 * High-performance, zero-allocation matrix math for Kalman Filter prediction
 * and measurement update calculations, plus backward-compatible array-based operations.
 */

import {
  normalizeAngleRad as sharedNormalizeAngleRad,
  normalizeAngleDeg as sharedNormalizeAngleDeg,
  matrixInverse as sharedMatrixInverse,
} from '@navic/shared-models';

export type Matrix = number[][];
export type Vector = number[];

export { sharedNormalizeAngleRad as normalizeAngleRad };
export { sharedNormalizeAngleDeg as normalizeAngleDeg };

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
  return sharedMatrixInverse(A);
}

// ─── High-Performance Float64Array-backed Matrix System ─────────────────────

/**
 * Fixed-size 2D matrix backed by a contiguous Float64Array.
 * Designed for zero-allocation in-place linear algebra operations in real-time loops.
 */
export class Float64Matrix {
  public readonly rows: number;
  public readonly cols: number;
  public readonly data: Float64Array;

  constructor(rows: number, cols: number, initialData?: ArrayLike<number>) {
    this.rows = rows;
    this.cols = cols;
    this.data = new Float64Array(rows * cols);
    if (initialData) {
      this.data.set(initialData);
    }
  }

  public get(r: number, c: number): number {
    return this.data[r * this.cols + c];
  }

  public set(r: number, c: number, val: number): void {
    this.data[r * this.cols + c] = val;
  }

  public fill(val: number): this {
    this.data.fill(val);
    return this;
  }

  public setZero(): this {
    this.data.fill(0);
    return this;
  }

  public setIdentity(): this {
    this.data.fill(0);
    const n = Math.min(this.rows, this.cols);
    for (let i = 0; i < n; i++) {
      this.data[i * this.cols + i] = 1.0;
    }
    return this;
  }

  public copyFrom(other: Float64Matrix): this {
    this.data.set(other.data);
    return this;
  }

  public symmetrize(): this {
    Float64Matrix.symmetrize(this);
    return this;
  }

  public to2DArray(): number[][] {
    const res: number[][] = new Array(this.rows);
    for (let r = 0; r < this.rows; r++) {
      const row = new Array(this.cols);
      const offset = r * this.cols;
      for (let c = 0; c < this.cols; c++) {
        row[c] = this.data[offset + c];
      }
      res[r] = row;
    }
    return res;
  }

  public static from2DArray(arr: number[][]): Float64Matrix {
    const rows = arr.length;
    const cols = rows > 0 ? arr[0].length : 0;
    const m = new Float64Matrix(rows, cols);
    for (let r = 0; r < rows; r++) {
      const offset = r * cols;
      for (let c = 0; c < cols; c++) {
        m.data[offset + c] = arr[r][c];
      }
    }
    return m;
  }

  /**
   * In-place matrix multiplication: out = A * B.
   * Note: out must NOT be A or B.
   */
  public static multiply(A: Float64Matrix, B: Float64Matrix, out: Float64Matrix): void {
    const rowsA = A.rows;
    const colsA = A.cols;
    const colsB = B.cols;
    const dataA = A.data;
    const dataB = B.data;
    const dataOut = out.data;

    dataOut.fill(0);

    for (let i = 0; i < rowsA; i++) {
      const rowOffsetA = i * colsA;
      const rowOffsetOut = i * colsB;
      for (let k = 0; k < colsA; k++) {
        const a = dataA[rowOffsetA + k];
        if (a === 0) continue;
        const rowOffsetB = k * colsB;
        for (let j = 0; j < colsB; j++) {
          dataOut[rowOffsetOut + j] += a * dataB[rowOffsetB + j];
        }
      }
    }
  }

  /**
   * In-place matrix addition: out = A + B.
   */
  public static add(A: Float64Matrix, B: Float64Matrix, out: Float64Matrix): void {
    const len = A.data.length;
    const dataA = A.data;
    const dataB = B.data;
    const dataOut = out.data;
    for (let i = 0; i < len; i++) {
      dataOut[i] = dataA[i] + dataB[i];
    }
  }

  /**
   * In-place matrix subtraction: out = A - B.
   */
  public static sub(A: Float64Matrix, B: Float64Matrix, out: Float64Matrix): void {
    const len = A.data.length;
    const dataA = A.data;
    const dataB = B.data;
    const dataOut = out.data;
    for (let i = 0; i < len; i++) {
      dataOut[i] = dataA[i] - dataB[i];
    }
  }

  /**
   * In-place matrix transpose: out = A^T.
   */
  public static transpose(A: Float64Matrix, out: Float64Matrix): void {
    const rows = A.rows;
    const cols = A.cols;
    const dataA = A.data;
    const dataOut = out.data;

    for (let r = 0; r < rows; r++) {
      const offsetIn = r * cols;
      for (let c = 0; c < cols; c++) {
        dataOut[c * rows + r] = dataA[offsetIn + c];
      }
    }
  }

  /**
   * Multiplies matrix by column vector: out = A * x.
   */
  public static multiplyVector(
    A: Float64Matrix,
    x: Float64Array | number[],
    out: Float64Array | number[]
  ): void {
    const rows = A.rows;
    const cols = A.cols;
    const dataA = A.data;

    for (let i = 0; i < rows; i++) {
      let sum = 0;
      const offset = i * cols;
      for (let j = 0; j < cols; j++) {
        sum += dataA[offset + j] * x[j];
      }
      out[i] = sum;
    }
  }

  /**
   * Scales matrix in-place: out = s * A.
   */
  public static scale(A: Float64Matrix, s: number, out: Float64Matrix): void {
    const len = A.data.length;
    const dataA = A.data;
    const dataOut = out.data;
    for (let i = 0; i < len; i++) {
      dataOut[i] = dataA[i] * s;
    }
  }

  /**
   * Inverts a square matrix into `out` using Gauss-Jordan with partial pivoting.
   * Uses an optional pre-allocated scratch buffer for zero memory allocation.
   */
  public static invert(
    A: Float64Matrix,
    out: Float64Matrix,
    scratchAug?: Float64Array
  ): boolean {
    const n = A.rows;
    if (n !== A.cols || n !== out.rows || n !== out.cols) {
      throw new Error('Matrix must be square and matching dimensions for invert');
    }

    const augCols = 2 * n;
    const aug = scratchAug && scratchAug.length >= n * augCols
      ? scratchAug
      : new Float64Array(n * augCols);

    // Populate augmented matrix: [A | I]
    for (let i = 0; i < n; i++) {
      const augRow = i * augCols;
      const aRow = i * n;
      for (let j = 0; j < n; j++) {
        aug[augRow + j] = A.data[aRow + j];
        aug[augRow + n + j] = i === j ? 1.0 : 0.0;
      }
    }

    // Gauss-Jordan elimination
    for (let col = 0; col < n; col++) {
      let maxVal = Math.abs(aug[col * augCols + col]);
      let maxRow = col;

      for (let r = col + 1; r < n; r++) {
        const val = Math.abs(aug[r * augCols + col]);
        if (val > maxVal) {
          maxVal = val;
          maxRow = r;
        }
      }

      if (maxVal < 1e-12) {
        // Regularize near-singular geometry
        aug[col * augCols + col] += 1e-6;
      }

      // Swap rows if necessary
      if (maxRow !== col) {
        const r1 = col * augCols;
        const r2 = maxRow * augCols;
        for (let j = 0; j < augCols; j++) {
          const tmp = aug[r1 + j];
          aug[r1 + j] = aug[r2 + j];
          aug[r2 + j] = tmp;
        }
      }

      const pivot = aug[col * augCols + col];
      if (Math.abs(pivot) < 1e-15) {
        return false;
      }

      const invPivot = 1.0 / pivot;
      const pivotRowOffset = col * augCols;
      for (let j = 0; j < augCols; j++) {
        aug[pivotRowOffset + j] *= invPivot;
      }

      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const rOffset = r * augCols;
        const factor = aug[rOffset + col];
        if (Math.abs(factor) < 1e-15) continue;
        for (let j = 0; j < augCols; j++) {
          aug[rOffset + j] -= factor * aug[pivotRowOffset + j];
        }
      }
    }

    // Extract inverted matrix from right half of augmented matrix
    for (let i = 0; i < n; i++) {
      const augRow = i * augCols + n;
      const outRow = i * n;
      for (let j = 0; j < n; j++) {
        out.data[outRow + j] = aug[augRow + j];
      }
    }

    return true;
  }

  /**
   * Symmetrizes an n x n matrix in-place and ensures positive diagonal elements.
   */
  public static symmetrize(A: Float64Matrix): void {
    const n = A.rows;
    const data = A.data;
    for (let i = 0; i < n; i++) {
      const iOffset = i * n;
      for (let j = i + 1; j < n; j++) {
        const val = 0.5 * (data[iOffset + j] + data[j * n + i]);
        data[iOffset + j] = val;
        data[j * n + i] = val;
      }
      if (data[iOffset + i] < 1e-9) {
        data[iOffset + i] = 1e-9;
      }
    }
  }
}

/**
 * Creates a 3x3 rotation matrix from an Android rotation vector quaternion (qx, qy, qz, [qw]).
 */
export function rotationMatrixFromRotationVector(
  x: number,
  y: number,
  z: number,
  w?: number
): Float64Matrix {
  let qw = w;
  if (qw === undefined) {
    const sinHalfThetaSq = x * x + y * y + z * z;
    qw = sinHalfThetaSq < 1.0 ? Math.sqrt(1.0 - sinHalfThetaSq) : 0;
  }

  const R = new Float64Matrix(3, 3);
  const qx = x;
  const qy = y;
  const qz = z;
  const qx2 = x * x;
  const qy2 = y * y;
  const qz2 = z * z;

  R.set(0, 0, 1 - 2 * (qy2 + qz2));
  R.set(0, 1, 2 * (x * y - qz * qw));
  R.set(0, 2, 2 * (x * z + qy * qw));

  R.set(1, 0, 2 * (x * y + qz * qw));
  R.set(1, 1, 1 - 2 * (qx2 + qz2));
  R.set(1, 2, 2 * (y * z - qx * qw));

  R.set(2, 0, 2 * (x * z - qy * qw));
  R.set(2, 1, 2 * (y * z + qx * qw));
  R.set(2, 2, 1 - 2 * (qx2 + qy2));

  return R;
}
