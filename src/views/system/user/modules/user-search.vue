<template>
  <ArtSearchBar
    ref="searchBarRef"
    v-model="formData"
    :items="formItems"
    :rules="rules"
    @reset="handleReset"
    @search="handleSearch"
  >
  </ArtSearchBar>
</template>

<script setup lang="ts">
  interface Props {
    modelValue: Record<string, any>
  }
  interface Emits {
    (e: 'update:modelValue', value: Record<string, any>): void
    (e: 'search', params: Record<string, any>): void
    (e: 'reset'): void
  }
  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  // 表单数据双向绑定
  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  // 校验规则（当前简单查询不做必填校验）
  const rules = {}

  // 表单配置（字段参考旧项目 AdminManagement：account、phone）
  const formItems = computed(() => [
    {
      label: '用户名',
      key: 'account',
      type: 'input',
      placeholder: '请输入用户名',
      clearable: true
    }
    // {
    //   label: '手机号',
    //   key: 'phone',
    //   type: 'input',
    //   props: { placeholder: '请输入手机号', maxlength: '11' }
    // }
  ])

  // 事件
  function handleReset() {
    emit('reset')
  }

  async function handleSearch() {
    await searchBarRef.value.validate()
    emit('search', formData.value)
  }
</script>
