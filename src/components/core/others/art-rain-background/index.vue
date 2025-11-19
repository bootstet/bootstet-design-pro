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

  // 片元着色器：Heartfelt - 心形雨滴玻璃效果（改自 Shadertoy）
  const fragmentShader = /* glsl */ `
  // Heartfelt - by Martijn Steinrucken aka BigWings - 2017
  // Email:countfrolic@gmail.com Twitter:@The_ArtOfCode
  // License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

  // I revisited the rain effect I did for another shader. This one is better in multiple ways:
  // 1. The glass gets foggy.
  // 2. Drops cut trails in the fog on the glass.
  // 3. The amount of rain is adjustable (with Mouse.y)

  // 为简化集成到 Three.js，这里保留心形雨滴和雾化玻璃效果，去掉音频等外部依赖。

  precision highp float;

  varying vec2 vUv;
  uniform float iTime;
  uniform vec3  iResolution;
  uniform sampler2D iChannel0; // 背景纹理
  uniform vec4  iMouse;        // 这里传入 (0,0,0,0)，保留接口，逻辑与 Shadertoy 一致

  #define S(a, b, t) smoothstep(a, b, t)
  //#define CHEAP_NORMALS
  // 心形效果已移除，不再启用 HAS_HEART，仅保留后期特效
  #define USE_POST_PROCESSING

  vec3 N13(float p) {
    //  from DAVE HOSKINS
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3((p3.x + p3.y)*p3.z,
                      (p3.x + p3.z)*p3.y,
                      (p3.y + p3.z)*p3.x));
  }

  vec4 N14(float t) {
    return fract(sin(t*vec4(123., 1024., 1456., 264.))*vec4(6547., 345., 8799., 1564.));
  }
  float N(float t) {
    return fract(sin(t*12345.564)*7658.76);
  }

  float Saw(float b, float t) {
    return S(0., b, t)*S(1., b, t);
  }

  vec2 DropLayer2(vec2 uv, float t) {
    vec2 UV = uv;

    uv.y += t*0.75;
    vec2 a = vec2(6., 1.);
    vec2 grid = a*2.;
    vec2 id = floor(uv*grid);

    float colShift = N(id.x);
    uv.y += colShift;

    id = floor(uv*grid);
    vec3 n = N13(id.x*35.2+id.y*2376.1);
    vec2 st = fract(uv*grid)-vec2(.5, 0.);

    float x = n.x-.5;

    float y = UV.y*20.;
    float wiggle = sin(y+sin(y));
    x += wiggle*(.5-abs(x))*(n.z-.5);
    x *= .7;
    float ti = fract(t+n.z);
    y = (Saw(.85, ti)-.5)*.9+.5;
    vec2 p = vec2(x, y);

    float d = length((st-p)*a.yx);

    float mainDrop = S(.4, .0, d);

    float r = sqrt(S(1., y, st.y));
    float cd = abs(st.x-x);
    float trail = S(.23*r, .15*r*r, cd);
    float trailFront = S(-.02, .02, st.y-y);
    trail *= trailFront*r*r;

    y = UV.y;
    float trail2 = S(.2*r, .0, cd);
    float droplets = max(0., (sin(y*(1.-y)*120.)-st.y))*trail2*trailFront*n.z;
    y = fract(y*10.)+(st.y-.5);
    float dd = length(st-vec2(x, y));
    droplets = S(.3, 0., dd);
    float m = mainDrop+droplets*r*trailFront;

    return vec2(m, trail);
  }

  float StaticDrops(vec2 uv, float t) {
    uv *= 40.;

    vec2 id = floor(uv);
    uv = fract(uv)-.5;
    vec3 n = N13(id.x*107.45+id.y*3543.654);
    vec2 p = (n.xy-.5)*.7;
    float d = length(uv-p);

    float fade = Saw(.025, fract(t+n.z));
    float c = S(.3, 0., d)*fract(n.z*10.)*fade;
    return c;
  }

  vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
    float s = StaticDrops(uv, t)*l0;
    vec2 m1 = DropLayer2(uv, t)*l1;
    vec2 m2 = DropLayer2(uv*1.85, t)*l2;

    float c = s+m1.x+m2.x;
    c = S(.3, 1., c);

    return vec2(c, max(m1.y*l0, m2.y*l1));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // 将 Shadertoy 风格的坐标系转换为以高度归一化的 uv
    vec2 uv = (fragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    // 屏幕空间 [0,1] 坐标，用于采样背景纹理
    vec2 UV = fragCoord.xy / iResolution.xy;

    // 从 iMouse 构造一个和原版兼容的向量（当前项目中 iMouse 为 (0,0,0,0)）
    vec3 M = iMouse.xyz / iResolution.xyz;
    float T = iTime + M.x * 2.0;

    float t = T * 0.2;

    // 全屏雨滴强度：不使用心形 mask，简单用时间的正弦变化雨量
    float rainAmount = iMouse.z > 0.0 ? M.y : sin(T * 0.05) * 0.3 + 0.7;

    // 雾化范围（模糊强度）随雨量变化
    float maxBlur = mix(3.0, 6.0, rainAmount);
    float minBlur = 2.0;

    // 故事线参数（用于后期闪电/色偏），暂时保留接口但不使用心形
    float story = 0.0;
    float heart = 0.0; // 已不再用于控制雨量，只保留占位，方便以后扩展

    // 全屏缩放动画（原来心形版本中的 else 分支）：
    // 轻微 zoom in/out，让背景和雨滴有呼吸感
    float zoom = -cos(T * 0.2);
    uv *= 0.7 + zoom * 0.3;
    // UV 也做对应缩放，用于采样背景纹理
    UV = (UV - 0.5) * (0.9 + zoom * 0.1) + 0.5;

    float staticDrops = S(-.5, 1., rainAmount)*2.;
    float layer1 = S(.25, .75, rainAmount);
    float layer2 = S(.0, .5, rainAmount);

    vec2 c = Drops(uv, t, staticDrops, layer1, layer2);

    // 通过雨滴 mask 的梯度估算法线，用于折射背景纹理，形成“玻璃凸起”效果
    #ifdef CHEAP_NORMALS
      vec2 n = vec2(dFdx(c.x), dFdy(c.x));
    #else
      vec2 e = vec2(0.001, 0.0);
      float cx = Drops(uv + e,     t, staticDrops, layer1, layer2).x;
      float cy = Drops(uv + e.yx,  t, staticDrops, layer1, layer2).x;
      vec2 n = vec2(cx - c.x, cy - c.x);
    #endif

    float focus = mix(maxBlur-c.y, minBlur, S(.1, .2, c.x));

    // Shadertoy 原版使用 textureLod，WebGL1 中不可直接使用，这里用普通采样 + 位移近似
    vec3 col = texture2D(iChannel0, UV + n * 0.02 * focus).rgb;

    #ifdef USE_POST_PROCESSING
      // 轻微色偏 + 闪电效果 + 暗角，整体气氛更“雨夜”
      t = (T + 3.0) * 0.5;
      float colFade = sin(t * 0.2) * 0.5 + 0.5 + story;
      col *= mix(vec3(1.0), vec3(0.8, 0.9, 1.3), colFade);

      float fade = S(0.0, 10.0, T); // 入场渐显
      float lightning = sin(t * sin(t * 10.0));
      lightning *= pow(max(0.0, sin(t + sin(t))), 10.0);
      col *= 1.0 + lightning * fade * mix(1.0, 0.1, story * story);

      // 简单 vignette 暗角
      vec2 UVc = UV - 0.5;
      col *= 1.0 - dot(UVc, UVc);

      // 目前不再对心形区域做特殊处理，仅保留整体淡入淡出
      col *= fade;
    #endif

    fragColor = vec4(col, 1.);
  }

  void main() {
    vec4 color;
    // gl_FragCoord.xy 与 Shadertoy 中的 fragCoord 对应
    mainImage(color, gl_FragCoord.xy);
    gl_FragColor = color;
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
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(width, height)
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

      // 注意：iResolution 需要使用实际绘制缓冲区尺寸（包含像素比），
      // 否则在高 DPI 设备上会出现背景和雨滴只占据左下角的问题。
      const pixelRatio = renderer.getPixelRatio()
      const material = new THREE.ShaderMaterial({
        uniforms: {
          iResolution: { value: new THREE.Vector3(width * pixelRatio, height * pixelRatio, 1) },
          iTime: { value: 0 },
          iChannel0: { value: bgTexture },
          // 当前未接入鼠标事件，统一传入 0，保留接口以便后续扩展
          iMouse: { value: new THREE.Vector4(0, 0, 0, 0) }
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
      const pixelRatio = renderer.getPixelRatio()
      camera.left = -asp
      camera.right = asp
      camera.top = 1.0
      camera.bottom = -1.0
      camera.updateProjectionMatrix()

      plane.geometry.dispose()
      plane.geometry = new THREE.PlaneGeometry(2 * asp, 2)

      const uniforms = plane.material.uniforms
      // 同样在 resize 时更新为实际绘制缓冲区尺寸，保证 shader 中坐标计算正确
      uniforms.iResolution.value.set(w * pixelRatio, h * pixelRatio, 1)
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
