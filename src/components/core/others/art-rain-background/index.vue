<template>
  <div ref="containerRef" class="art-rain-bg"></div>
</template>

<script setup lang="ts">
  /**
   * ArtRainBackground - Three.js Shader 雨天玻璃效果
   *
   * 基于 N13 / DropLayer2 思路，实现全屏雨滴玻璃效果：
   * - 使用正交相机 + 全屏平面
   * - 片元着色器中根据时间生成雨滴 mask，并与背景图混合
   */

  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import * as THREE from 'three'

  defineOptions({ name: 'ArtRainBackground' })

  const containerRef = ref<HTMLDivElement | null>(null)

  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.OrthographicCamera | null = null
  let plane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  let animationId: number | null = null
  let startTime = 0

  // 背景图：换成你自己的模糊城市/室内图也可以
  const BG_TEXTURE_PATH = new URL('@/assets/images/common/rain-bg.png', import.meta.url).href

  // 顶点着色器：透传 uv
  const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

  // 片元着色器：集成 N13 + DropLayer2
  const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float iTime;
  uniform vec3 iResolution;
  uniform sampler2D iChannel0;

  // 生成随机数
  vec3 N13(float p) {
      vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract(vec3(
        (p3.x + p3.y) * p3.z,
        (p3.x + p3.z) * p3.y,
        (p3.y + p3.z) * p3.x
      ));
  }

  // 雨滴层（含纵向拖尾 + 随机偏移）
  vec2 DropLayer2(vec2 uv, float t) {
      uv.y += t * 0.32;                   // 速度再慢一点
      vec2 grid = vec2(8.0, 1.2) * 2.0;   // x 方向更密、y 稍大
      vec2 id = floor(uv * grid);
      vec3 n = N13(id.x * 35.2 + id.y * 2376.1);

      // 引入一点横向偏移，让雨滴略微左右晃
      float offset = (n.z - 0.5) * 0.12;
      vec2 st = fract(uv * grid) - vec2(0.5 + offset, 0.0);

      // 纵向拉伸 + 轻微椭圆
      vec2 stretch = vec2(0.75, 2.3);
      float d = length((st - vec2(n.x - 0.5, n.y - 0.5)) * stretch);

      // 让边缘柔和，核心更细
      float dropMask = smoothstep(0.32, 0.0, d);

      // 做一个纵向拖尾（模拟水痕）
      float trail = smoothstep(-0.05, 0.3, st.y + 0.25) * dropMask;

      return vec2(dropMask, trail);
  }

  // 对背景做个轻微模糊，模拟玻璃失焦
  vec3 blurBackground(vec2 uv, sampler2D tex) {
      vec2 px = 1.5 / iResolution.xy;
      vec3 col = vec3(0.0);
      col += texture2D(tex, uv + vec2(-px.x, -px.y)).rgb;
      col += texture2D(tex, uv + vec2( px.x, -px.y)).rgb;
      col += texture2D(tex, uv + vec2(-px.x,  px.y)).rgb;
      col += texture2D(tex, uv + vec2( px.x,  px.y)).rgb;
      col += 2.0 * texture2D(tex, uv).rgb;
      return col / 6.0;
  }

  void main() {
      vec2 uv = vUv;

      vec3 bg = blurBackground(uv, iChannel0);
      bg *= 0.88;
      bg = mix(bg, vec3(0.82, 0.9, 1.0), 0.12); // 雨天偏冷

      float t = iTime;
      vec2 drops = DropLayer2(uv, t);
      float mask = drops.x;
      float trail = drops.y;

      // Gamma 校正
      float softMask = pow(mask, 1.25);

      float intensity = 0.65;
      vec3 highlight = vec3(0.88, 0.93, 1.0);

      // 把拖尾当成额外的透明高光
      float trailHighlight = trail * 0.45;

      vec3 color = mix(bg, highlight, softMask * intensity + trailHighlight);

      gl_FragColor = vec4(color, 1.0);
  }
`

  const initScene = () => {
    const container = containerRef.value
    if (!container) return

    const width = window.innerWidth
    const height = window.innerHeight
    const aspect = width / height

    scene = new THREE.Scene()

    // 正交相机铺满全屏
    camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10)
    camera.position.z = 1

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.domElement.style.pointerEvents = 'none'
    renderer.domElement.style.position = 'fixed'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.zIndex = '0'

    container.appendChild(renderer.domElement)

    const loader = new THREE.TextureLoader()
    const bgTexture = loader.load(BG_TEXTURE_PATH, () => {
      bgTexture.wrapS = THREE.ClampToEdgeWrapping
      bgTexture.wrapT = THREE.ClampToEdgeWrapping
      bgTexture.minFilter = THREE.LinearFilter
      bgTexture.magFilter = THREE.LinearFilter

      const geometry = new THREE.PlaneGeometry(2 * aspect, 2)

      const material = new THREE.ShaderMaterial({
        uniforms: {
          iResolution: { value: new THREE.Vector3(width, height, 1) },
          iTime: { value: 0 },
          iChannel0: { value: bgTexture }
        },
        vertexShader,
        fragmentShader,
        transparent: true
      })

      plane = new THREE.Mesh(geometry, material)
      scene!.add(plane)

      startTime = performance.now()
      animate()
    })

    const handleResize = () => {
      if (!renderer || !camera || !plane) return
      const w = window.innerWidth
      const h = window.innerHeight
      const asp = w / h

      renderer.setSize(w, h)
      camera.left = -asp
      camera.right = asp
      camera.top = 1.0
      camera.bottom = -1.0
      camera.updateProjectionMatrix()

      plane.geometry.dispose()
      plane.geometry = new THREE.PlaneGeometry(2 * asp, 2)

      const uniforms = plane.material.uniforms
      uniforms.iResolution.value.set(w, h, 1)
    }

    window.addEventListener('resize', handleResize)
  }

  const animate = () => {
    if (!renderer || !scene || !camera || !plane) return

    const elapsed = (performance.now() - startTime) / 1000.0
    plane.material.uniforms.iTime.value = elapsed

    renderer.render(scene, camera)
    animationId = requestAnimationFrame(animate)
  }

  const disposeScene = () => {
    if (animationId != null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    if (plane) {
      plane.geometry.dispose()
      plane.material.dispose()
      plane = null
    }

    if (renderer) {
      renderer.dispose()
      const canvas = renderer.domElement
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
      renderer = null
    }

    scene = null
    camera = null
  }

  onMounted(() => {
    initScene()
  })

  onBeforeUnmount(() => {
    disposeScene()
  })
</script>

<style scoped>
  .art-rain-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }
</style>
