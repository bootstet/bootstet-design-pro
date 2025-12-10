<template>
  <ElDialog
    v-model="visible"
    :title="dialogType === 'add' ? '新增角色' : '编辑角色'"
    width="700px"
    align-center
    @close="handleClose"
  >
    <ElScrollbar height="70vh">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
        <!-- 角色基础信息 -->
        <ElFormItem label="角色名称" prop="name">
          <ElInput v-model="form.name" placeholder="请输入角色名称" />
        </ElFormItem>
        <ElFormItem label="角色描述" prop="describes">
          <ElInput
            v-model="form.describes"
            type="textarea"
            :rows="3"
            placeholder="请输入角色描述"
          />
        </ElFormItem>

        <!-- 菜单权限 -->
        <ElFormItem label="菜单权限">
          <div class="flex justify-between items-start w-full gap-2">
            <ElTree
              ref="menuTreeRef"
              class="tree-border flex-1"
              :data="menuTree"
              show-checkbox
              node-key="id"
              :props="menuTreeProps"
              highlight-current
              :default-expand-all="false"
            />
            <ElButton type="primary" link size="small" @click="toggleMenuExpand">
              {{ isMenuExpanded ? '全部收起' : '全部展开' }}
            </ElButton>
          </div>
        </ElFormItem>

        <!-- 数据权限 -->
        <ElFormItem label="数据权限">
          <ElRadioGroup v-model="dataScopeLocal" class="data-scope-group">
            <ElRadio label="2">本人</ElRadio>
            <ElRadio label="3">本人及下属</ElRadio>
            <ElRadio label="4">自定义部门</ElRadio>
            <ElRadio label="1">全部</ElRadio>
          </ElRadioGroup>
        </ElFormItem>

        <!-- 自定义部门树 -->
        <ElFormItem v-if="dataScopeLocal === '4'" label="">
          <ElTree
            ref="deptTreeRef"
            class="tree-border"
            :data="deptTree"
            show-checkbox
            node-key="id"
            :props="deptTreeProps"
            default-expand-all
            style="max-height: 300px; overflow: auto"
          />
        </ElFormItem>
      </ElForm>
    </ElScrollbar>

    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" @click="handleSubmit">确定</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    fetchAdminRoleSaveOrUpdate,
    type AdminRoleItem,
    fetchAllMenus,
    fetchMenuByRole,
    fetchDeptTree
  } from '@/api/system-manage'

  type RoleListItem = AdminRoleItem

  interface Props {
    modelValue: boolean
    dialogType: 'add' | 'edit'
    roleData?: RoleListItem
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    dialogType: 'add',
    roleData: undefined
  })

  const emit = defineEmits<Emits>()

  const formRef = ref<FormInstance>()

  /**
   * 弹窗显示状态双向绑定
   */
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  /**
   * 表单验证规则
   */
  const rules = reactive<FormRules>({
    name: [
      { required: true, message: '请输入角色名称', trigger: 'blur' },
      { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
    ],
    describes: [{ required: false, message: '请输入角色描述', trigger: 'blur' }]
  })

  /**
   * 表单数据
   */
  const form = reactive<RoleListItem>({
    id: 0,
    name: '',
    describes: '',
    dataScope: '1',
    dataScopeDept: ''
  } as RoleListItem)

  // 本地数据权限（用字符串存储，方便和旧项目保持一致）
  const dataScopeLocal = ref<string>('1')

  // 菜单树 & 部门树数据
  const menuTree = ref<any[]>([])
  const deptTree = ref<any[]>([])

  const menuTreeRef = ref()
  const deptTreeRef = ref()

  const isMenuExpanded = ref(false)

  const menuTreeProps = {
    children: 'children',
    label: 'label'
  }

  const deptTreeProps = {
    children: 'children',
    label: 'deptName'
  }

  /**
   * 监听弹窗打开，初始化表单数据
   */
  watch(
    () => props.modelValue,
    (newVal) => {
      if (newVal) initForm()
    }
  )

  /**
   * 监听角色数据变化，更新表单
   */
  watch(
    () => props.roleData,
    (newData) => {
      if (newData && props.modelValue) initForm()
    },
    { deep: true }
  )

  /**
   * 初始化表单数据
   * 根据弹窗类型填充表单或重置表单
   */
  const initForm = async () => {
    // 基础字段
    if (props.dialogType === 'edit' && props.roleData) {
      Object.assign(form, props.roleData)
    } else {
      Object.assign(form, {
        id: 0,
        name: '',
        describes: '',
        dataScope: '1',
        dataScopeDept: ''
      } as RoleListItem)
    }

    dataScopeLocal.value = String(form.dataScope || '1')

    // 加载菜单树
    await loadMenuTree()

    // 加载部门树（用于数据权限）
    await loadDeptTree()
  }

  /**
   * 关闭弹窗并重置表单
   */
  const handleClose = () => {
    visible.value = false
    formRef.value?.resetFields()
  }

  // 加载菜单树（全部菜单）
  const loadMenuTree = async () => {
    const res = await fetchAllMenus()
    // 兼容 data 或直接数组
    const raw = (res as any)?.data || (res as any)?.list || res || []

    const transform = (items: any[]): any[] => {
      return (items || []).map((item) => {
        const node: any = {
          id: item.id,
          label: item.name || item.label || '',
          children: [] as any[]
        }
        const children = item.childMenu || item.children
        if (children && children.length) {
          node.children = transform(children)
        }
        return node
      })
    }

    menuTree.value = transform(raw)

    // 如果是编辑状态，加载该角色已有的菜单权限
    if (form.id) {
      const roleMenus = await fetchMenuByRole({ id: form.id })
      const roleRaw = (roleMenus as any)?.data || (roleMenus as any) || []

      const collectIds = (items: any[]): (number | string)[] => {
        const ids: (number | string)[] = []
        const walk = (list: any[]) => {
          list.forEach((it) => {
            if (it.id != null) ids.push(it.id)
            const children = it.childMenu || it.children
            if (children && children.length) walk(children)
          })
        }
        walk(items || [])
        return ids
      }

      const checkedIds = collectIds(roleRaw)
      nextTick(() => {
        menuTreeRef.value?.setCheckedKeys(checkedIds, true)
      })
    } else {
      nextTick(() => {
        menuTreeRef.value?.setCheckedKeys([], false)
      })
    }

    // 初始化时认为是展开状态
    isMenuExpanded.value = false
  }

  // 切换菜单树全部展开/收起
  const toggleMenuExpand = () => {
    const tree = menuTreeRef.value
    if (!tree) return

    // 参考 Element Plus 内部结构，遍历所有节点设置 expanded
    const nodesMap = tree.store?.nodesMap || {}
    Object.values(nodesMap).forEach((node: any) => {
      node.expanded = !isMenuExpanded.value
    })

    isMenuExpanded.value = !isMenuExpanded.value
  }

  // 加载部门树（数据权限为自定义部门时使用）
  const loadDeptTree = async () => {
    const res = await fetchDeptTree()
    const raw = (res as any)?.data || res || []
    deptTree.value = raw

    if (dataScopeLocal.value === '4' && form.dataScopeDept) {
      const ids = form.dataScopeDept
        .split(',')
        .map((v) => (v ? Number(v) : v))
        .filter(Boolean)
      nextTick(() => {
        deptTreeRef.value?.setCheckedKeys(ids, true)
      })
    }
  }

  /**
   * 提交表单
   * 验证通过后调用接口保存数据
   */
  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      await formRef.value.validate()

      // 同步数据权限
      form.dataScope = dataScopeLocal.value

      // 处理菜单权限：选中 + 半选中
      const menuIds: (number | string)[] = []
      if (menuTreeRef.value) {
        const checked = menuTreeRef.value.getCheckedKeys()
        const half = menuTreeRef.value.getHalfCheckedKeys()
        menuIds.push(...checked, ...half)
      }

      // 处理数据权限部门
      if (dataScopeLocal.value === '4' && deptTreeRef.value) {
        const deptIds = deptTreeRef.value.getCheckedKeys() as (number | string)[]
        form.dataScopeDept = deptIds.join(',')
      } else {
        form.dataScopeDept = ''
      }

      const payload: any = {
        name: form.name,
        describes: form.describes,
        dataScope: form.dataScope,
        dataScopeDept: form.dataScopeDept,
        menuIdList: Array.from(new Set(menuIds))
      }

      // 只有编辑时才带 id，新增时让后端自己生成
      if (form.id) {
        payload.id = form.id
      }

      await fetchAdminRoleSaveOrUpdate(payload)

      const message = props.dialogType === 'add' ? '新增成功' : '修改成功'
      ElMessage.success(message)
      emit('success')
      handleClose()
    } catch (error) {
      console.log('表单验证失败:', error)
    }
  }
</script>

<style scoped>
  .data-scope-group {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
  }
</style>
