module.exports = {
  // 继承配置
  extends: [
    'stylelint-config-standard', // CSS 标准规则
    'stylelint-config-recommended-scss', // SCSS 推荐规则
    'stylelint-config-recommended-vue' // Vue 文件推荐规则
  ],

  // 插件
  plugins: ['stylelint-scss'], // SCSS 插件

  rules: {
    // ==================== SCSS at-rule 规则 ====================

    // 禁用通用 at-rule 检查，允许自定义的 at-rule
    'at-rule-no-unknown': null,

    // 检查 SCSS at-rule，但允许 @reference、@use、@import 这些 SCSS 导入语句
    'scss/at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['reference', 'use', 'import']
      }
    ],

    // ==================== 伪类选择器规则 ====================

    // 检查未知伪类，但允许 Vue 和 CSS Modules 的特殊伪类
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global', 'local', 'export', 'deep']
      }
    ],

    // ==================== CSS 单位规则 ====================

    // 检查未知单位，但允许小程序的 rpx 单位
    'unit-no-unknown': [
      true,
      {
        ignoreUnits: ['rpx']
      }
    ],

    // ==================== 禁用规则（提高编写灵活性）====================

    // 禁用 ID 选择器限制，允许在必要时使用 ID 选择器
    'selector-max-id': null,

    // 禁用优先级检查，实际项目中常常需要提高优先级来覆盖框架样式
    'no-descending-specificity': null,

    // 禁用类名格式检查，兼容 Element Plus 等第三方 UI 库的命名规范（如 .el-menu--horizontal）
    'selector-class-pattern': null,

    // 禁用关键帧名称格式检查，允许使用驼峰式命名（如 slideInRight、fadeInUp）
    'keyframes-name-pattern': null,

    // 禁用 CSS 变量名称格式检查，兼容现有的命名习惯（如 --textColor、--ElColor-primary）
    'custom-property-pattern': null,

    // 禁用厂商前缀检查，有时需要使用 -webkit-、-moz- 等前缀以支持旧浏览器
    'property-no-vendor-prefix': null,

    // 禁用 import 语句格式检查，允许简写形式而不强制使用 url() 包装
    'import-notation': null,

    // 禁用未知属性值检查，某些 CSS 属性值可能来自 CSS 变量或是实验性特性
    'declaration-property-value-no-unknown': null,

    // 禁用 at-rule 前空行检查，提高代码编写灵活性
    'at-rule-empty-line-before': null
  },

  // ==================== Vue 文件覆盖配置 ====================
  overrides: [
    {
      files: ['**/*.vue'],
      // 使用 postcss-html 语法解析器，正确识别 Vue 文件中的 <style> 块内容
      // 这确保 stylelint 不会把 Vue 模板中的代码当作 CSS 检查
      customSyntax: 'postcss-html'
    }
  ]
}
