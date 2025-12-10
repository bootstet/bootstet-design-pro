<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '添加后台用户' : '编辑后台用户'"
    width="480px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="90px">
      <ElFormItem label="用户名" prop="account">
        <ElInput
          v-model="formData.account"
          :disabled="dialogType === 'edit'"
          placeholder="请输入用户名"
        />
      </ElFormItem>
      <ElFormItem label="所属部门" prop="deptId">
        <ElSelect v-model="formData.deptId" placeholder="请选择所属部门" filterable>
          <ElOption
            v-for="dept in deptList"
            :key="dept.id"
            :label="dept.deptName"
            :value="dept.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="角色" prop="roleId">
        <ElSelect v-model="formData.roleId" placeholder="请选择角色">
          <ElOption v-for="role in roleList" :key="role.id" :value="role.id" :label="role.name" />
        </ElSelect>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { DialogType } from '@/types'
  import {
    type AdminUserItem,
    fetchAddAdminUser,
    fetchUpdateAdminUser,
    fetchAdminDeptList,
    fetchAdminRoleSimpleList
  } from '@/api/system-manage'

  interface Props {
    visible: boolean
    type: DialogType
    userData?: Partial<AdminUserItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  // 部门、角色选项
  const deptList = ref<{ id: number; deptName: string }[]>([])
  const roleList = ref<{ id: number; name: string }[]>([])

  // 对话框显示控制
  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const dialogType = computed(() => props.type)

  // 表单实例
  const formRef = ref<FormInstance>()

  // 表单数据（字段参考旧项目 AdminManagementEdit）
  const formData = reactive({
    account: '',
    deptId: undefined as number | undefined,
    roleId: undefined as number | undefined,
    userId: undefined as number | undefined
  })

  // 表单验证规则
  const rules: FormRules = {
    account: [
      { required: true, message: '请输入用户名', trigger: 'blur' },
      { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
    ],
    deptId: [{ required: true, message: '请选择所属部门', trigger: 'change' }],
    roleId: [{ required: true, message: '请选择角色', trigger: 'change' }]
  }

  // 初始化表单数据
  const initFormData = () => {
    const row = props.userData
    if (dialogType.value === 'edit' && row) {
      formData.account = row.account || ''
      formData.deptId = (row as any).deptId
      formData.roleId = (row as any).roleId
      formData.userId = row.id as number
    } else {
      formData.account = ''
      formData.deptId = undefined
      formData.roleId = undefined
      formData.userId = undefined
    }
  }

  // 加载部门、角色选项（接口字段对接旧项目）
  const loadOptions = async () => {
    deptList.value = await fetchAdminDeptList()
    roleList.value = await fetchAdminRoleSimpleList()
  }

  // 监听对话框状态变化，打开时初始化表单并加载选项
  watch(
    () => [props.visible, props.type, props.userData],
    async ([visible]) => {
      if (visible) {
        initFormData()
        await loadOptions()
        nextTick(() => {
          formRef.value?.clearValidate()
        })
      }
    },
    { immediate: true }
  )

  // 提交表单：区分新增 / 编辑，对接旧项目接口
  const handleSubmit = async () => {
    if (!formRef.value) return

    await formRef.value.validate(async (valid) => {
      if (!valid) return

      if (dialogType.value === 'add') {
        await fetchAddAdminUser({
          account: formData.account,
          deptId: formData.deptId!,
          roleId: formData.roleId!
        })
      } else {
        await fetchUpdateAdminUser({
          userId: formData.userId!,
          account: formData.account,
          deptId: formData.deptId!,
          roleId: formData.roleId!
        })
      }

      dialogVisible.value = false
      emit('submit')
    })
  }
</script>
