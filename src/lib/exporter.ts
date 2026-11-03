/**
 * HeroForge Character STL Exporter
 *
 * Exports the currently displayed HeroForge 3D character as STL files.
 * Separates base/pedestal meshes from character meshes and exports as a ZIP.
 *
 * Usage:
 *   1. Import and call exportCharacter() from the browser console
 *   2. Or paste the compiled JS version directly
 */

// ============================================================
// Type Declarations for HeroForge/RenderKit globals
// ============================================================

declare const CK: {
  activeDisplay: {
    meshes: Record<string, Mesh>
  }
  scene: {
    updateMatrixWorld(force: boolean): void
  }
}

declare const RK: {
  Matrix4: new () => Matrix4
  Vec3: new (x: number, y: number, z: number) => Vec3
}

// ============================================================
// Type Definitions
// ============================================================

interface Vec3 {
  x: number
  y: number
  z: number
  clone(): Vec3
  copy(v: Vec3): Vec3
  applyMatrix4(m: Matrix4): Vec3
  addScaledVector(v: Vec3, s: number): Vec3
  divideScalar(s: number): Vec3
}

interface Matrix4 {
  elements: number[]
  copy(m: Matrix4): Matrix4
  multiply(m: Matrix4): Matrix4
}

interface BufferAttribute {
  count: number
  array: ArrayLike<number>
  getX(index: number): number
  getY(index: number): number
  getZ(index: number): number
  getW(index: number): number
}

interface BufferGeometry {
  type: string
  attributes: {
    position: BufferAttribute
    skin0?: BufferAttribute
    skin1?: BufferAttribute
    skin2?: BufferAttribute
    skin3?: BufferAttribute
    [key: string]: BufferAttribute | undefined
  }
  index: { array: ArrayLike<number> } | null
  morphAttributes?: {
    position?: BufferAttribute[]
  }
  groups?: Array<{ start: number; count: number; materialIndex?: number }>
}

interface MaterialLike {
  name?: string
  color?: unknown
  map?: unknown
  [key: string]: unknown
}

interface Bone {
  matrixWorld: Matrix4
  getMatrixWorld?(): Matrix4
  updateMatrixWorld(force: boolean): void
}

interface Skeleton {
  bones: Bone[]
  boneInverses: Matrix4[]
  update?(): void
}

interface Mesh {
  isMesh: boolean
  isSkinnedMesh: boolean
  visible: boolean
  name: string
  geometry: BufferGeometry
  material?: MaterialLike | MaterialLike[]
  skeleton?: Skeleton
  matrixWorld: Matrix4
  bindMatrix?: Matrix4
  bindMatrixInverse?: Matrix4
  morphTargetInfluences?: number[]
  children?: Mesh[]
  updateMatrixWorld(force: boolean): void
}

interface Vertex {
  x: number
  y: number
  z: number
}

interface Triangle {
  v1: Vertex
  v2: Vertex
  v3: Vertex
}

interface ExportOptions {
  filename?: string
  scale?: number
  separateBase?: boolean
  format?: 'stl' | 'glb'
}

interface CollectedMeshes {
  characterMeshes: Mesh[]
  baseMeshes: Mesh[]
}

interface ZipFile {
  name: string
  data: Uint8Array
}

interface LocalHeader {
  header: ArrayBuffer
  data: Uint8Array
  offset: number
}

// ============================================================
// SimpleZip - Minimal ZIP library
// ============================================================

/**
 * Simple ZIP file creator
 * Creates uncompressed ZIP files (STORE method)
 */
class SimpleZip {
  private files: ZipFile[] = []
  private static _crc32Table: Uint32Array | null = null

  addFile(name: string, data: ArrayBuffer): void {
    this.files.push({ name, data: new Uint8Array(data) })
  }

  generate(): ArrayBuffer {
    const localHeaders: LocalHeader[] = []
    const centralHeaders: ArrayBuffer[] = []
    let offset = 0

    // Create local file headers and file data
    for (const file of this.files) {
      const nameBytes = new TextEncoder().encode(file.name)
      const localHeader = this._createLocalHeader(nameBytes, file.data)
      localHeaders.push({ header: localHeader, data: file.data, offset })
      offset += localHeader.byteLength + file.data.byteLength
    }

    // Create central directory
    const centralStart = offset
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i]
      const nameBytes = new TextEncoder().encode(file.name)
      const centralHeader = this._createCentralHeader(nameBytes, file.data, localHeaders[i].offset)
      centralHeaders.push(centralHeader)
      offset += centralHeader.byteLength
    }
    const centralEnd = offset

    // Create end of central directory
    const eocd = this._createEOCD(this.files.length, centralEnd - centralStart, centralStart)
    offset += eocd.byteLength

    // Combine all parts
    const result = new Uint8Array(offset)
    let pos = 0

    for (const local of localHeaders) {
      result.set(new Uint8Array(local.header), pos)
      pos += local.header.byteLength
      result.set(local.data, pos)
      pos += local.data.byteLength
    }

    for (const central of centralHeaders) {
      result.set(new Uint8Array(central), pos)
      pos += central.byteLength
    }

    result.set(new Uint8Array(eocd), pos)

    return result.buffer
  }

  private _createLocalHeader(nameBytes: Uint8Array, data: Uint8Array): ArrayBuffer {
    const header = new ArrayBuffer(30 + nameBytes.length)
    const view = new DataView(header)

    view.setUint32(0, 0x04034b50, true) // Local file header signature
    view.setUint16(4, 20, true) // Version needed
    view.setUint16(6, 0, true) // General purpose bit flag
    view.setUint16(8, 0, true) // Compression method (STORE)
    view.setUint16(10, 0, true) // File last mod time
    view.setUint16(12, 0, true) // File last mod date
    view.setUint32(14, this._crc32(data), true) // CRC-32
    view.setUint32(18, data.byteLength, true) // Compressed size
    view.setUint32(22, data.byteLength, true) // Uncompressed size
    view.setUint16(26, nameBytes.length, true) // File name length
    view.setUint16(28, 0, true) // Extra field length

    new Uint8Array(header).set(nameBytes, 30)

    return header
  }

  private _createCentralHeader(nameBytes: Uint8Array, data: Uint8Array, localOffset: number): ArrayBuffer {
    const header = new ArrayBuffer(46 + nameBytes.length)
    const view = new DataView(header)

    view.setUint32(0, 0x02014b50, true) // Central directory signature
    view.setUint16(4, 20, true) // Version made by
    view.setUint16(6, 20, true) // Version needed
    view.setUint16(8, 0, true) // General purpose bit flag
    view.setUint16(10, 0, true) // Compression method (STORE)
    view.setUint16(12, 0, true) // File last mod time
    view.setUint16(14, 0, true) // File last mod date
    view.setUint32(16, this._crc32(data), true) // CRC-32
    view.setUint32(20, data.byteLength, true) // Compressed size
    view.setUint32(24, data.byteLength, true) // Uncompressed size
    view.setUint16(28, nameBytes.length, true) // File name length
    view.setUint16(30, 0, true) // Extra field length
    view.setUint16(32, 0, true) // File comment length
    view.setUint16(34, 0, true) // Disk number start
    view.setUint16(36, 0, true) // Internal file attributes
    view.setUint32(38, 0, true) // External file attributes
    view.setUint32(42, localOffset, true) // Relative offset of local header

    new Uint8Array(header).set(nameBytes, 46)

    return header
  }

  private _createEOCD(numFiles: number, centralSize: number, centralOffset: number): ArrayBuffer {
    const eocd = new ArrayBuffer(22)
    const view = new DataView(eocd)

    view.setUint32(0, 0x06054b50, true) // EOCD signature
    view.setUint16(4, 0, true) // Disk number
    view.setUint16(6, 0, true) // Disk with central directory
    view.setUint16(8, numFiles, true) // Number of entries on this disk
    view.setUint16(10, numFiles, true) // Total number of entries
    view.setUint32(12, centralSize, true) // Size of central directory
    view.setUint32(16, centralOffset, true) // Offset of central directory
    view.setUint16(20, 0, true) // Comment length

    return eocd
  }

  private _crc32(data: Uint8Array): number {
    let crc = 0xffffffff
    if (!SimpleZip._crc32Table) SimpleZip._crc32Table = this._makeCRCTable()
    const table = SimpleZip._crc32Table

    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff]
    }

    return (crc ^ 0xffffffff) >>> 0
  }

  private _makeCRCTable(): Uint32Array {
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      table[i] = c
    }
    return table
  }
}

// ============================================================
// Skinning and Mesh Processing Functions
// ============================================================

/**
 * Decode HeroForge skin weight encoding
 * From shader: abs(mod(weight + 1.0, 2.0) - 1.0)
 */
function decodeWeight(encodedWeight: number): number {
  const mod = (n: number, m: number): number => ((n % m) + m) % m
  return Math.abs(mod(encodedWeight + 1, 2) - 1)
}

/**
 * Get bone matrix - computes skinMatrix (bone.matrixWorld * boneInverse)
 */
function getBoneMatrix(skeleton: Skeleton, boneIndex: number): Matrix4 {
  const tempMatrix = new RK.Matrix4()

  const maxBoneIndex = skeleton.bones ? skeleton.bones.length - 1 : -1
  if (boneIndex < 0 || boneIndex > maxBoneIndex) {
    return tempMatrix
  }

  const bone = skeleton.bones[boneIndex]
  const boneInverse = skeleton.boneInverses ? skeleton.boneInverses[boneIndex] : null

  if (bone && boneInverse) {
    const boneWorld = bone.matrixWorld || (bone.getMatrixWorld ? bone.getMatrixWorld() : null)
    if (boneWorld) {
      tempMatrix.copy(boneWorld)
      tempMatrix.multiply(boneInverse)
      return tempMatrix
    }
  }

  return tempMatrix
}

/**
 * Apply skinning to a vertex with a custom position (for morph targets)
 */
function skinVertexWithPosition(mesh: Mesh, vertexIndex: number, x: number, y: number, z: number): Vec3 {
  const geometry = mesh.geometry
  const skeleton = mesh.skeleton
  const position = new RK.Vec3(x, y, z)

  const skinAttrs: BufferAttribute[] = []
  for (let i = 0; i < 4; i++) {
    const attr = geometry.attributes[`skin${i}`]
    if (attr) {
      skinAttrs.push(attr)
    }
  }

  if (skinAttrs.length === 0 || !skeleton) {
    position.applyMatrix4(mesh.matrixWorld)
    return position
  }

  const bindIsIdentity = isIdentityMatrix(mesh.bindMatrix)

  const skinVert = position.clone()
  if (!bindIsIdentity && mesh.bindMatrix) {
    skinVert.applyMatrix4(mesh.bindMatrix)
  }

  const skinned = new RK.Vec3(0, 0, 0)
  let skinSum = 0

  for (const skinAttr of skinAttrs) {
    const boneIdx0 = Math.floor(skinAttr.getX(vertexIndex))
    const weight0 = decodeWeight(skinAttr.getY(vertexIndex))
    const boneIdx1 = Math.floor(skinAttr.getZ(vertexIndex))
    const weight1 = decodeWeight(skinAttr.getW(vertexIndex))

    if (weight0 > 0.0001) {
      const boneMatrix = getBoneMatrix(skeleton, boneIdx0)
      const transformed = skinVert.clone()
      transformed.applyMatrix4(boneMatrix)
      skinned.addScaledVector(transformed, weight0)
      skinSum += weight0
    }

    if (weight1 > 0.0001) {
      const boneMatrix = getBoneMatrix(skeleton, boneIdx1)
      const transformed = skinVert.clone()
      transformed.applyMatrix4(boneMatrix)
      skinned.addScaledVector(transformed, weight1)
      skinSum += weight1
    }
  }

  if (skinSum > 0.0001) {
    skinned.divideScalar(skinSum)
  } else {
    skinned.copy(skinVert)
  }

  if (!bindIsIdentity && mesh.bindMatrixInverse) {
    skinned.applyMatrix4(mesh.bindMatrixInverse)
  }

  // Skinning returns a vertex in mesh-local coordinates. Match the regular
  // mesh path by applying the world transform before exporting it.
  skinned.applyMatrix4(mesh.matrixWorld)
  return skinned
}

/**
 * Check if a matrix is identity (or close to it)
 */
function isIdentityMatrix(matrix: Matrix4 | undefined): boolean {
  if (!matrix) return true
  const e = matrix.elements
  const epsilon = 0.0001
  return (
    Math.abs(e[0] - 1) < epsilon &&
    Math.abs(e[1]) < epsilon &&
    Math.abs(e[2]) < epsilon &&
    Math.abs(e[3]) < epsilon &&
    Math.abs(e[4]) < epsilon &&
    Math.abs(e[5] - 1) < epsilon &&
    Math.abs(e[6]) < epsilon &&
    Math.abs(e[7]) < epsilon &&
    Math.abs(e[8]) < epsilon &&
    Math.abs(e[9]) < epsilon &&
    Math.abs(e[10] - 1) < epsilon &&
    Math.abs(e[11]) < epsilon &&
    Math.abs(e[12]) < epsilon &&
    Math.abs(e[13]) < epsilon &&
    Math.abs(e[14]) < epsilon &&
    Math.abs(e[15] - 1) < epsilon
  )
}

/**
 * Check if a slot/mesh name indicates it's part of the base/pedestal
 */
function isBaseMesh(slotName: string | undefined, meshName: string | undefined): boolean {
  const lowerSlot = (slotName || '').toLowerCase()
  const lowerName = (meshName || '').toLowerCase()

  // Check if slot or mesh name starts with "base" or contains base-related terms
  return (
    lowerSlot.startsWith('base') ||
    lowerName.startsWith('base') ||
    lowerSlot.includes('pedestal') ||
    lowerName.includes('pedestal')
  )
}

/**
 * Check if a mesh should be included in export
 */
function shouldIncludeMesh(mesh: Mesh, slotName: string | undefined): boolean {
  if (!mesh || !mesh.geometry) return false
  if (!mesh.visible) return false
  if (slotName?.startsWith('_')) return false
  if (mesh.name === 'facePads' || mesh.name === '_debugPass') return false

  const posAttr = mesh.geometry.attributes.position
  if (!posAttr || posAttr.count < 3) return false

  if (mesh.geometry.type === 'PlaneBufferGeometry' || mesh.geometry.type === 'PlaneGeometry') {
    return false
  }

  const lowerName = (mesh.name || '').toLowerCase()
  if (
    lowerName.includes('ground') ||
    lowerName.includes('floor') ||
    lowerName.includes('plane') ||
    lowerName.includes('shadow') ||
    lowerName.includes('reflector')
  ) {
    return false
  }

  const lowerSlot = (slotName || '').toLowerCase()
  if (
    lowerSlot.includes('ground') ||
    lowerSlot.includes('floor') ||
    lowerSlot.includes('plane') ||
    lowerSlot.includes('shadow') ||
    lowerSlot.includes('reflector')
  ) {
    return false
  }

  return true
}

/**
 * Collect all visible meshes, separated into character and base meshes
 */
function collectMeshes(): CollectedMeshes {
  const characterMeshes: Mesh[] = []
  const baseMeshes: Mesh[] = []
  const display = CK.activeDisplay

  if (!display || !display.meshes) {
    console.error('No active display found.')
    return { characterMeshes, baseMeshes }
  }

  function collectRecursive(object: Mesh, slotName: string | undefined): void {
    if (!object) return
    if ((object.isMesh || object.isSkinnedMesh) && shouldIncludeMesh(object, slotName)) {
      if (isBaseMesh(slotName, object.name)) {
        baseMeshes.push(object)
      } else {
        characterMeshes.push(object)
      }
    }
    if (object.children) {
      for (const child of object.children) {
        if (child.name !== 'facePads' && child.name !== '_debugPass') {
          collectRecursive(child, slotName)
        }
      }
    }
  }

  for (const [slotName, mesh] of Object.entries(display.meshes)) {
    if (!mesh || slotName.startsWith('_')) continue
    collectRecursive(mesh, slotName)
  }

  console.log(`Collected ${characterMeshes.length} character meshes, ${baseMeshes.length} base meshes`)
  return { characterMeshes, baseMeshes }
}

interface ExtractedGeometry {
  positions: number[]
  indices: ArrayLike<number> | null
}

/**
 * Extract posed geometry from a mesh
 */
function extractMeshGeometry(mesh: Mesh): ExtractedGeometry {
  const geometry = mesh.geometry
  const positionAttr = geometry.attributes.position
  const count = positionAttr.count

  mesh.updateMatrixWorld(true)
  if (mesh.skeleton) {
    if (mesh.skeleton.bones) {
      for (const bone of mesh.skeleton.bones) {
        if (bone) bone.updateMatrixWorld(true)
      }
    }
    if (mesh.skeleton.update) {
      mesh.skeleton.update()
    }
  }

  const hasMorphTargets = geometry.morphAttributes?.position && geometry.morphAttributes.position.length > 0
  const morphInfluences = mesh.morphTargetInfluences || []

  const positions: number[] = []
  const indices = geometry.index ? geometry.index.array : null

  const isSkinnedMesh = mesh.isSkinnedMesh && mesh.skeleton && geometry.attributes.skin0

  for (let i = 0; i < count; i++) {
    let baseX = positionAttr.getX(i)
    let baseY = positionAttr.getY(i)
    let baseZ = positionAttr.getZ(i)

    if (hasMorphTargets && geometry.morphAttributes?.position) {
      const morphPositions = geometry.morphAttributes.position
      for (let m = 0; m < morphPositions.length; m++) {
        const influence = morphInfluences[m] || 0
        if (influence > 0.0001) {
          const morphAttr = morphPositions[m]
          baseX += morphAttr.getX(i) * influence
          baseY += morphAttr.getY(i) * influence
          baseZ += morphAttr.getZ(i) * influence
        }
      }
    }

    let vertex: Vec3

    if (isSkinnedMesh) {
      vertex = skinVertexWithPosition(mesh, i, baseX, baseY, baseZ)
    } else {
      vertex = new RK.Vec3(baseX, baseY, baseZ)
      vertex.applyMatrix4(mesh.matrixWorld)
    }

    positions.push(vertex.x, vertex.y, vertex.z)
  }

  return { positions, indices }
}

/**
 * Check if a vertex has valid coordinates
 */
function isValidVertex(v: Vertex): boolean {
  const MAX_COORD = 100
  return Math.abs(v.x) < MAX_COORD && Math.abs(v.y) < MAX_COORD && Math.abs(v.z) < MAX_COORD
}

/**
 * Merge mesh geometries into triangles
 */
function collectTriangles(meshes: Mesh[]): Triangle[] {
  const allTriangles: Triangle[] = []
  let skippedTriangles = 0

  for (const mesh of meshes) {
    const { positions, indices } = extractMeshGeometry(mesh)

    const getVertex = (idx: number): Vertex => ({
      x: positions[idx * 3],
      y: positions[idx * 3 + 1],
      z: positions[idx * 3 + 2],
    })

    const addTriangle = (i0: number, i1: number, i2: number): void => {
      const v1 = getVertex(i0)
      const v2 = getVertex(i1)
      const v3 = getVertex(i2)

      if (!isValidVertex(v1) || !isValidVertex(v2) || !isValidVertex(v3)) {
        skippedTriangles++
        return
      }

      allTriangles.push({ v1, v2, v3 })
    }

    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        addTriangle(indices[i], indices[i + 1], indices[i + 2])
      }
    } else {
      const vertCount = positions.length / 3
      for (let i = 0; i < vertCount; i += 3) {
        addTriangle(i, i + 1, i + 2)
      }
    }
  }

  if (skippedTriangles > 0) {
    console.warn(`Skipped ${skippedTriangles} triangles with invalid coordinates`)
  }

  return allTriangles
}

/**
 * Transform triangles to match HeroForge orientation and scale
 */
function transformTriangles(triangles: Triangle[], scale: number): Triangle[] {
  // Transform to match HeroForge orientation (Z up)
  for (const tri of triangles) {
    for (const v of [tri.v1, tri.v2, tri.v3]) {
      const oldY = v.y
      const oldZ = v.z
      v.y = -oldZ * scale
      v.z = oldY * scale
      v.x = v.x * scale
    }
  }

  // Move to ground plane
  let minZ = Number.POSITIVE_INFINITY
  for (const tri of triangles) {
    for (const v of [tri.v1, tri.v2, tri.v3]) {
      minZ = Math.min(minZ, v.z)
    }
  }

  const zOffset = -minZ + 2.5
  for (const tri of triangles) {
    for (const v of [tri.v1, tri.v2, tri.v3]) {
      v.z += zOffset
    }
  }

  return triangles
}

/**
 * Calculate face normal
 */
function calculateNormal(v1: Vertex, v2: Vertex, v3: Vertex): Vertex {
  const ax = v2.x - v1.x
  const ay = v2.y - v1.y
  const az = v2.z - v1.z
  const bx = v3.x - v1.x
  const by = v3.y - v1.y
  const bz = v3.z - v1.z

  let nx = ay * bz - az * by
  let ny = az * bx - ax * bz
  let nz = ax * by - ay * bx

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (len > 0) {
    nx /= len
    ny /= len
    nz /= len
  }

  return { x: nx, y: ny, z: nz }
}

/**
 * Generate binary STL
 */
function trianglesToSTL(triangles: Triangle[], headerText = 'HeroForge Export'): ArrayBuffer {
  const triangleCount = triangles.length
  const bufferLength = 80 + 4 + triangleCount * 50
  const buffer = new ArrayBuffer(bufferLength)
  const dataView = new DataView(buffer)

  for (let i = 0; i < 80; i++) {
    dataView.setUint8(i, i < headerText.length ? headerText.charCodeAt(i) : 0)
  }

  dataView.setUint32(80, triangleCount, true)

  let offset = 84

  for (const tri of triangles) {
    const normal = calculateNormal(tri.v1, tri.v2, tri.v3)

    dataView.setFloat32(offset, normal.x, true)
    offset += 4
    dataView.setFloat32(offset, normal.y, true)
    offset += 4
    dataView.setFloat32(offset, normal.z, true)
    offset += 4

    dataView.setFloat32(offset, tri.v1.x, true)
    offset += 4
    dataView.setFloat32(offset, tri.v1.y, true)
    offset += 4
    dataView.setFloat32(offset, tri.v1.z, true)
    offset += 4

    dataView.setFloat32(offset, tri.v2.x, true)
    offset += 4
    dataView.setFloat32(offset, tri.v2.y, true)
    offset += 4
    dataView.setFloat32(offset, tri.v2.z, true)
    offset += 4

    dataView.setFloat32(offset, tri.v3.x, true)
    offset += 4
    dataView.setFloat32(offset, tri.v3.y, true)
    offset += 4
    dataView.setFloat32(offset, tri.v3.z, true)
    offset += 4

    dataView.setUint16(offset, 0, true)
    offset += 2
  }

  return buffer
}

/**
 * Download file
 */
function downloadFile(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

interface GLTFMeshData {
  mesh: Mesh
  positions: number[]
  indices: number[]
  uvs?: number[]
  colors?: number[]
  normals: number[]
}

function align4(value: number): number {
  return (value + 3) & ~3
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

function getTextureCandidate(material: MaterialLike): unknown {
  const keys = ['map', 'baseColorMap', 'albedoMap', 'diffuseMap', 'colorMap', 'texture']
  for (const key of keys) {
    const candidate = material[key]
    const record = asRecord(candidate)
    if (record && (record.image || record.source || record.data)) return candidate
  }

  const uniforms = asRecord(material.uniforms)
  if (uniforms) {
    for (const uniform of Object.values(uniforms)) {
      const value = asRecord(uniform)?.value
      const record = asRecord(value)
      if (record && (record.image || record.source || record.data)) return value
    }
  }
  return undefined
}

function textureImage(texture: unknown): unknown {
  const record = asRecord(texture)
  if (!record) return undefined
  const source = asRecord(record.source)
  return record.image ?? source?.data ?? record.data
}

async function imageToBytes(source: unknown): Promise<{ bytes: Uint8Array; mimeType: string } | undefined> {
  if (source instanceof Blob) {
    return { bytes: new Uint8Array(await source.arrayBuffer()), mimeType: source.type || 'image/png' }
  }

  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    canvas.getContext('2d')?.drawImage(source, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: 'image/png' } : undefined
  }

  if (source instanceof HTMLImageElement) {
    if (!source.complete || source.naturalWidth === 0) return undefined
  } else if (source instanceof HTMLCanvasElement) {
    if (source.width === 0 || source.height === 0) return undefined
  } else {
    return undefined
  }

  const canvas = document.createElement('canvas')
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.drawImage(source, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: 'image/png' } : undefined
}

function materialColor(material: MaterialLike): [number, number, number, number] {
  const opacity = typeof material.opacity === 'number' ? material.opacity : 1
  const color = material.color
  const colorRecord = asRecord(color)
  if (colorRecord && typeof colorRecord.r === 'number') {
    return [colorRecord.r, Number(colorRecord.g ?? colorRecord.r), Number(colorRecord.b ?? colorRecord.r), opacity]
  }
  if (Array.isArray(color) && color.length >= 3) {
    return [Number(color[0]), Number(color[1]), Number(color[2]), Number(color[3] ?? opacity)]
  }
  if (typeof color === 'number' && Number.isFinite(color)) {
    return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255, opacity]
  }
  return [0.72, 0.72, 0.72, opacity]
}

function computeVertexNormals(positions: number[], indices: number[]): number[] {
  const normals = new Array<number>(positions.length).fill(0)
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const ia = indices[i] * 3
    const ib = indices[i + 1] * 3
    const ic = indices[i + 2] * 3
    const ax = positions[ib] - positions[ia]
    const ay = positions[ib + 1] - positions[ia + 1]
    const az = positions[ib + 2] - positions[ia + 2]
    const bx = positions[ic] - positions[ia]
    const by = positions[ic + 1] - positions[ia + 1]
    const bz = positions[ic + 2] - positions[ia + 2]
    const nx = ay * bz - az * by
    const ny = az * bx - ax * bz
    const nz = ax * by - ay * bx
    for (const vertex of [ia, ib, ic]) {
      normals[vertex] += nx
      normals[vertex + 1] += ny
      normals[vertex + 2] += nz
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1
    normals[i] /= length
    normals[i + 1] /= length
    normals[i + 2] /= length
  }
  return normals
}

async function meshesToGLB(meshes: Mesh[], scale: number): Promise<ArrayBuffer> {
  const extracted = meshes.map((mesh): GLTFMeshData => {
    const geometry = mesh.geometry
    const { positions: sourcePositions, indices } = extractMeshGeometry(mesh)
    const positions: number[] = []
    for (let i = 0; i < sourcePositions.length; i += 3) {
      positions.push(sourcePositions[i], sourcePositions[i + 1], sourcePositions[i + 2])
    }
    const vertexCount = positions.length / 3
    const indexList = indices ? Array.from(indices, Number) : Array.from({ length: vertexCount }, (_, i) => i)
    const uvAttribute = geometry.attributes.uv
    const uvs = uvAttribute
      ? Array.from({ length: vertexCount }, (_, i) => [uvAttribute.getX(i), uvAttribute.getY(i)]).flat()
      : undefined
    const colorAttribute = geometry.attributes.color
    const colors = colorAttribute
      ? Array.from({ length: vertexCount }, (_, i) => [
          colorAttribute.getX(i),
          colorAttribute.getY(i),
          colorAttribute.getZ(i),
        ]).flat()
      : undefined
    return { mesh, positions, indices: indexList, uvs, colors, normals: [] }
  })

  let minZ = Number.POSITIVE_INFINITY
  for (const item of extracted) {
    for (let i = 0; i < item.positions.length; i += 3) {
      const oldY = item.positions[i + 1]
      const oldZ = item.positions[i + 2]
      item.positions[i] *= scale
      item.positions[i + 1] = -oldZ * scale
      item.positions[i + 2] = oldY * scale
      minZ = Math.min(minZ, item.positions[i + 2])
    }
  }
  const zOffset = Number.isFinite(minZ) ? -minZ + 2.5 : 0
  for (const item of extracted) {
    for (let i = 2; i < item.positions.length; i += 3) item.positions[i] += zOffset
    item.normals = computeVertexNormals(item.positions, item.indices)
  }

  const binParts: Uint8Array[] = []
  const views: Array<Record<string, number>> = []
  const accessors: Array<Record<string, unknown>> = []
  const materials: Array<Record<string, unknown>> = []
  const images: Array<Record<string, unknown>> = []
  const textures: Array<Record<string, unknown>> = []
  const samplers: Array<Record<string, unknown>> = []
  const gltfMeshes: Array<Record<string, unknown>> = []
  const nodes: Array<Record<string, unknown>> = []
  const textureCache = new Map<unknown, number>()
  let inaccessibleTextureCount = 0
  let binaryLength = 0
  const bufferLength = () => binaryLength

  const addBytes = (bytes: Uint8Array, target?: number): number => {
    const currentLength = bufferLength()
    const offset = align4(currentLength)
    if (offset > currentLength) {
      binParts.push(new Uint8Array(offset - currentLength))
      binaryLength = offset
    }
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, ...(target ? { target } : {}) })
    binParts.push(bytes)
    binaryLength += bytes.byteLength
    return views.length - 1
  }

  const addFloatAccessor = (values: number[], type: string, count: number, includeBounds = false): number => {
    const bytes = new Uint8Array(values.length * 4)
    const view = new DataView(bytes.buffer)
    values.forEach((value, index) => view.setFloat32(index * 4, value, true))
    const bufferView = addBytes(bytes, 34962)
    const accessor: Record<string, unknown> = { bufferView, componentType: 5126, count, type }
    if (includeBounds && count > 0) {
      const components = 3
      const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
      const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
      for (let i = 0; i < count; i++) {
        for (let axis = 0; axis < components; axis++) {
          const value = values[i * components + axis]
          min[axis] = Math.min(min[axis], value)
          max[axis] = Math.max(max[axis], value)
        }
      }
      accessor.min = min
      accessor.max = max
    }
    accessors.push(accessor)
    return accessors.length - 1
  }

  const addIndexAccessor = (values: number[]): number => {
    let max = 0
    for (const value of values) max = Math.max(max, value)
    const componentType = max <= 65535 ? 5123 : 5125
    const bytes = new Uint8Array(values.length * (componentType === 5123 ? 2 : 4))
    const view = new DataView(bytes.buffer)
    values.forEach((value, index) => {
      if (componentType === 5123) view.setUint16(index * 2, value, true)
      else view.setUint32(index * 4, value, true)
    })
    const bufferView = addBytes(bytes, 34963)
    accessors.push({ bufferView, componentType, count: values.length, type: 'SCALAR' })
    return accessors.length - 1
  }

  const getMaterialIndex = async (sourceMaterial: MaterialLike | undefined): Promise<number> => {
    const material = sourceMaterial ?? {}
    const pbr: Record<string, unknown> = {
      baseColorFactor: materialColor(material),
      metallicFactor: typeof material.metalness === 'number' ? material.metalness : 0,
      roughnessFactor: typeof material.roughness === 'number' ? material.roughness : 0.8,
    }
    const texture = getTextureCandidate(material)
    if (texture && !textureCache.has(texture)) {
      try {
        const image = await imageToBytes(textureImage(texture))
        if (image) {
          const imageView = addBytes(image.bytes)
          images.push({ bufferView: imageView, mimeType: image.mimeType, name: 'HeroForge texture' })
          textures.push({ sampler: 0, source: images.length - 1 })
          if (samplers.length === 0) samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 })
          textureCache.set(texture, textures.length - 1)
        } else {
          inaccessibleTextureCount++
        }
      } catch (error) {
        inaccessibleTextureCount++
        console.warn('Could not read a HeroForge texture; exporting its material color instead.', error)
      }
    }
    const textureIndex = texture ? textureCache.get(texture) : undefined
    if (textureIndex !== undefined) pbr.baseColorTexture = { index: textureIndex }
    const record = asRecord(material)
    const mat: Record<string, unknown> = {
      name: typeof record?.name === 'string' ? record.name : `Material ${materials.length + 1}`,
      pbrMetallicRoughness: pbr,
      alphaMode: record?.transparent === true ? 'BLEND' : 'OPAQUE',
      doubleSided: true,
    }
    materials.push(mat)
    return materials.length - 1
  }

  for (const item of extracted) {
    const sourceMaterials = Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material]
    const groups = item.mesh.geometry.groups?.length
      ? item.mesh.geometry.groups
      : [{ start: 0, count: item.indices.length, materialIndex: 0 }]
    const primitives: Array<Record<string, unknown>> = []
    const positionAccessor = addFloatAccessor(item.positions, 'VEC3', item.positions.length / 3, true)
    const normalAccessor = addFloatAccessor(item.normals, 'VEC3', item.normals.length / 3)
    const uvAccessor = item.uvs ? addFloatAccessor(item.uvs, 'VEC2', item.uvs.length / 2) : undefined
    const colorAccessor = item.colors ? addFloatAccessor(item.colors, 'VEC3', item.colors.length / 3) : undefined
    for (const group of groups) {
      const groupIndices = item.indices.slice(group.start, group.start + group.count)
      const sourceMaterial = sourceMaterials[group.materialIndex ?? 0]
      const materialIndex = await getMaterialIndex(sourceMaterial)
      const attributes: Record<string, number> = { POSITION: positionAccessor, NORMAL: normalAccessor }
      if (uvAccessor !== undefined) attributes.TEXCOORD_0 = uvAccessor
      if (colorAccessor !== undefined) attributes.COLOR_0 = colorAccessor
      primitives.push({ attributes, indices: addIndexAccessor(groupIndices), material: materialIndex, mode: 4 })
    }
    gltfMeshes.push({ name: item.mesh.name || `Mesh ${gltfMeshes.length + 1}`, primitives })
    nodes.push({ name: item.mesh.name || `Mesh ${nodes.length + 1}`, mesh: gltfMeshes.length - 1 })
  }

  const binaryByteLength = bufferLength()
  const binary = new Uint8Array(align4(binaryByteLength))
  let cursor = 0
  for (const part of binParts) {
    binary.set(part, cursor)
    cursor += part.length
  }
  const document: Record<string, unknown> = {
    asset: { version: '2.0', generator: 'HeroForge Exporter' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes: gltfMeshes,
    materials,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: binary.length }],
  }
  if (images.length) {
    document.images = images
    document.textures = textures
    document.samplers = samplers
  }

  const json = new TextEncoder().encode(JSON.stringify(document))
  const jsonLength = align4(json.length)
  const totalLength = 12 + 8 + jsonLength + 8 + binary.length
  if (totalLength > 0xffffffff) throw new Error('The generated GLB exceeds the 4 GB format limit.')
  const glb = new ArrayBuffer(totalLength)
  const data = new DataView(glb)
  data.setUint32(0, 0x46546c67, true)
  data.setUint32(4, 2, true)
  data.setUint32(8, totalLength, true)
  data.setUint32(12, jsonLength, true)
  data.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(glb, 20, json.length).set(json)
  new Uint8Array(glb, 20 + json.length, jsonLength - json.length).fill(0x20)
  const binaryHeader = 20 + jsonLength
  data.setUint32(binaryHeader, binary.length, true)
  data.setUint32(binaryHeader + 4, 0x004e4942, true)
  new Uint8Array(glb, binaryHeader + 8).set(binary)
  console.info(`GLB export: ${gltfMeshes.length} meshes, ${textures.length} textures.`)
  if (inaccessibleTextureCount > 0) {
    console.warn(
      `${inaccessibleTextureCount} texture(s) could not be read from HeroForge. Their material colors were exported instead.`,
    )
  }
  return glb
}

/**
 * Main export function
 * @param options.filename - Output filename (default: 'heroforge-character')
 * @param options.scale - Scale factor (default: 10 to match HeroForge export size)
 * @param options.separateBase - Export base and character separately in a ZIP (default: true)
 */
export function exportCharacter(options: ExportOptions = {}): void {
  const { filename = 'heroforge-character', scale = 10, separateBase = true, format = 'stl' } = options

  console.log('Starting HeroForge character export...')
  console.log(`  Scale: ${scale}x`)
  console.log(`  Separate base: ${separateBase}`)

  if (typeof CK === 'undefined' || typeof RK === 'undefined') {
    console.error('CK or RK not found. Make sure you are on the HeroForge character page.')
    return
  }

  if (CK.scene) {
    CK.scene.updateMatrixWorld(true)
  }

  const { characterMeshes, baseMeshes } = collectMeshes()

  if (characterMeshes.length === 0 && baseMeshes.length === 0) {
    console.error('No meshes found.')
    return
  }

  if (format === 'glb') {
    void meshesToGLB([...characterMeshes, ...baseMeshes], scale)
      .then((buffer) => {
        downloadFile(buffer, `${filename}.glb`)
        console.log(`GLB export complete: ${filename}.glb`)
      })
      .catch((error: unknown) => {
        console.error('GLB export failed.', error)
      })
    return
  }

  console.log('Applying bone transforms...')

  if (separateBase && baseMeshes.length > 0) {
    // Export as ZIP with separate files
    const zip = new SimpleZip()

    // Process character meshes
    if (characterMeshes.length > 0) {
      const charTriangles = collectTriangles(characterMeshes)
      transformTriangles(charTriangles, scale)
      const charSTL = trianglesToSTL(charTriangles, 'HeroForge Character')
      zip.addFile(`${filename}-character.stl`, charSTL)
      console.log(`Character: ${charTriangles.length} triangles`)
    }

    // Process base meshes
    if (baseMeshes.length > 0) {
      const baseTriangles = collectTriangles(baseMeshes)
      transformTriangles(baseTriangles, scale)
      const baseSTL = trianglesToSTL(baseTriangles, 'HeroForge Base')
      zip.addFile(`${filename}-base.stl`, baseSTL)
      console.log(`Base: ${baseTriangles.length} triangles`)
    }

    // Generate and download ZIP
    const zipBuffer = zip.generate()
    downloadFile(zipBuffer, `${filename}.zip`)

    console.log(`Export complete! Downloaded ${filename}.zip`)
  } else {
    // Export as single STL (combine all meshes)
    const allMeshes = [...characterMeshes, ...baseMeshes]
    const triangles = collectTriangles(allMeshes)
    transformTriangles(triangles, scale)

    console.log(`Total triangles: ${triangles.length}`)

    const stlBuffer = trianglesToSTL(triangles)
    downloadFile(stlBuffer, `${filename}.stl`)

    console.log(`Export complete! ${triangles.length} triangles, ${(stlBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`)
  }
}

// Export types for module consumers
export type { ExportOptions, Triangle, Vertex, CollectedMeshes }
