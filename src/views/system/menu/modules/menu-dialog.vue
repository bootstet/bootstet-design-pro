<template>
  <ElDialog
    :title="dialogTitle"
    :model-value="visible"
    @update:model-value="handleCancel"
    width="800px"
    align-center
    class="menu-dialog"
    @closed="handleClosed"
  >
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="formItems"
      :rules="rules"
      :span="width > 640 ? 12 : 24"
      :gutter="20"
      label-width="85px"
      :show-reset="false"
      :show-submit="false"
    >
      <template #menuType>
        <!-- 编辑时使用 ElTag 展示类型，新增时使用单选按钮选择类型（数值 1/2 对齐旧项目） -->
        <template v-if="isEdit">
          <ElTag :type="form.menuType === 1 ? 'primary' : 'success'">
            {{ form.menuType === 1 ? '菜单' : '按钮' }}
          </ElTag>
        </template>
        <template v-else>
          <ElRadioGroup v-model="form.menuType" :disabled="disableMenuType">
            <ElRadioButton :value="1">菜单</ElRadioButton>
            <ElRadioButton :value="2">按钮</ElRadioButton>
          </ElRadioGroup>
        </template>
      </template>

      <!-- 父级菜单选择，使用树形弹出框，对齐旧项目 -->
      <!-- ArtForm 传入的作用域是 { item, modelValue }，这里直接使用 form 以保持简单 -->
      <template #parentName>
        <ElPopover placement="bottom-start" trigger="click">
          <template #reference>
            <ElInput v-model="form.parentName" readonly autocomplete="off" />
          </template>
          <ElTree
            :data="menuTree"
            :props="menuTreeProps"
            node-key="id"
            :default-expanded-keys="[0]"
            highlight-current
            :expand-on-click-node="false"
            @current-change="
              (data: any) => {
                form.pid = data.id
                form.parentName = data.name
              }
            "
          />
        </ElPopover>
      </template>
    </ArtForm>

    <template #footer>
      <span class="dialog-footer">
        <ElButton @click="handleCancel">取 消</ElButton>
        <ElButton type="primary" @click="handleSubmit">确 定</ElButton>
      </span>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormRules } from 'element-plus'
  import { formatMenuTitle } from '@/utils/router'
  import type { FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import { useWindowSize } from '@vueuse/core'
  import { fetchAdminMenuTree, type AdminMenuItem } from '@/api/system-manage'
  import { AppRouteRecord } from '@/types'

  const { width } = useWindowSize()

  // 对齐旧项目 MenuManagementEdit 的数据结构
  interface MenuFormData {
    id: number | ''
    menuType: number // 1 菜单 2 按钮
    pid: number | ''
    parentName: string
    name: string
    path: string
    describes: string
    sort: number | ''
  }

  interface Props {
    visible: boolean
    editData?: AppRouteRecord | any
    type?: 'menu' | 'button'
    lockType?: boolean
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', data: MenuFormData): void
  }

  const props = withDefaults(defineProps<Props>(), {
    visible: false,
    type: 'menu',
    lockType: false
  })

  const emit = defineEmits<Emits>()

  const formRef = ref()
  const isEdit = ref(false)

  const form = reactive<MenuFormData>({
    id: '',
    menuType: 1,
    pid: 0,
    parentName: '一级菜单',
    name: '',
    path: '',
    describes: '',
    sort: 1
  })

  const rules = reactive<FormRules>({
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    path: [{ required: true, message: '请输入路径/标识', trigger: 'blur' }]
  })

  /**
   * 表单项配置（对齐旧项目：类型、父级、名称、路径、icon、排序）
   */
  const formItems = computed<FormItem[]>(() => {
    const baseItems: FormItem[] = [
      { label: '类型', key: 'menuType', span: 24 },
      { label: '父级菜单', key: 'parentName', type: 'input', span: 24, props: { readonly: true } }
    ]

    if (form.menuType !== 2) {
      // 菜单
      return [
        ...baseItems,
        { label: '菜单名称', key: 'name', type: 'input', props: { placeholder: '菜单名称' } },
        { label: '菜单路径', key: 'path', type: 'input', props: { placeholder: '菜单路径' } },
        { label: '菜单icon', key: 'describes', type: 'input', props: { placeholder: '菜单icon' } },
        {
          label: '菜单排序',
          key: 'sort',
          type: 'number',
          props: { min: 1, controlsPosition: 'right', style: { width: '100%' } }
        }
      ]
    } else {
      // 按钮
      return [
        ...baseItems,
        {
          label: '按钮名称',
          key: 'name',
          type: 'input',
          props: { placeholder: '按钮名称' }
        },
        {
          label: '按钮标识',
          key: 'path',
          type: 'input',
          props: { placeholder: '按钮标识' }
        },
        {
          label: '按钮描述',
          key: 'describes',
          type: 'input',
          props: { placeholder: '按钮描述' }
        }
      ]
    }
  })

  const dialogTitle = computed(() => {
    const type = form.menuType === 1 ? '菜单' : '按钮'
    return isEdit.value ? `编辑${type}` : `添加${type}`
  })

  /**
   * 是否禁用菜单类型切换
   */
  const disableMenuType = computed(() => {
    if (isEdit.value) return true
    if (!isEdit.value && form.menuType === 1 && props.lockType) return true
    return false
  })

  /**
   * 重置表单数据
   */
  const resetForm = (): void => {
    formRef.value?.reset()
    form.id = ''
    form.menuType = 1
    form.pid = 0
    form.parentName = '一级菜单'
    form.name = ''
    form.path = ''
    form.describes = ''
    form.sort = 1
  }

  /**
   * 将后端菜单树格式化为只包含菜单(menuType=1)的父级选择树
   */
  const formatParentTree = (data: AdminMenuItem[]): AdminMenuItem[] => {
    const list: AdminMenuItem[] = []
    for (const item of data) {
      if (item.menuType === 1) {
        const children = item.childMenu ? formatParentTree(item.childMenu) : []
        const node: AdminMenuItem = {
          id: item.id,
          pid: item.pid,
          name: item.name,
          path: item.path,
          describes: item.describes,
          sort: item.sort,
          menuType: item.menuType,
          childMenu: children
        }
        if (form.pid && form.pid === item.id) {
          form.parentName = item.name
        }
        list.push(node)
      }
    }
    return list
  }

  const menuTree = ref<AdminMenuItem[]>([])
  const menuTreeProps = {
    label: 'name',
    children: 'childMenu'
  }

  const fetchParentMenus = async (): Promise<void> => {
    const res = await fetchAdminMenuTree({ page: 1, limit: 1000 })
    const data = Array.isArray(res) ? res : (res as any).data || []
    menuTree.value = [
      {
        id: 0,
        pid: 0,
        name: '一级菜单',
        path: '',
        describes: '',
        sort: 0,
        menuType: 1,
        childMenu: formatParentTree(data)
      }
    ]
    if (!form.pid) {
      form.pid = 0
      form.parentName = '一级菜单'
    }
  }

  /**
   * 加载表单数据（编辑模式）
   */
  const loadFormData = (): void => {
    if (!props.editData) return

    isEdit.value = true

    if (form.menuType === 1) {
      const row: any = props.editData
      form.id = row.id || 0
      form.menuType = 1
      form.pid = row.pid ?? 0
      form.name = formatMenuTitle(row.meta?.title || row.name || '')
      form.path = row.path || ''
      form.describes = row.meta?.icon || row.describes || ''
      form.sort = row.meta?.sort || row.sort || 1
    } else {
      const row: any = props.editData
      form.menuType = 2
      form.name = row.title || ''
      form.path = row.authMark || ''
      form.describes = row.icon || ''
      form.sort = 1
    }
  }

  /**
   * 提交表单
   */
  const handleSubmit = async (): Promise<void> => {
    if (!formRef.value) return

    try {
      await formRef.value.validate()
      emit('submit', { ...form })
      // 接口成功提示由外层处理，这里只关闭弹窗
      handleCancel()
    } catch {
      ElMessage.error('表单校验失败，请检查输入')
    }
  }

  /**
   * 取消操作
   */
  const handleCancel = (): void => {
    emit('update:visible', false)
  }

  /**
   * 对话框关闭后的回调
   */
  const handleClosed = (): void => {
    resetForm()
    isEdit.value = false
  }

  /**
   * 监听对话框显示状态
   */
  watch(
    () => props.visible,
    (newVal) => {
      if (newVal) {
        form.menuType = props.type === 'button' ? 2 : 1
        nextTick(async () => {
          if (props.editData) {
            loadFormData()
          }
          await fetchParentMenus()
        })
      }
    }
  )

  /**
   * 监听菜单类型变化（仅在弹窗已打开时生效）
   */
  watch(
    () => props.type,
    (newType) => {
      if (props.visible) {
        form.menuType = newType === 'button' ? 2 : 1
      }
    }
  )
</script>
