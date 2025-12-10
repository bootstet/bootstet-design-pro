<template>
  <ElDialog v-model="visible" title="关联员工" width="800px" align-center @close="handleClose">
    <ArtSearchBar
      ref="searchBarRef"
      v-model="form"
      :items="searchItems"
      @reset="handleReset"
      @search="handleSearch"
    />

    <div class="mb-2">已选中 {{ selectedUsers.length }} 项</div>

    <ElTable
      ref="tableRef"
      :data="list"
      v-loading="loading"
      height="500"
      @select="selectRow"
      @select-all="selectAll"
    >
      <ElTableColumn type="selection" width="55" />
      <ElTableColumn prop="name" label="姓名" width="100" />
      <ElTableColumn prop="username" label="账号" width="150" />
      <ElTableColumn prop="phone" label="手机号" width="160" />
      <ElTableColumn prop="type" label="员工类型" width="140">
        <template #default="{ row }">
          <span>{{ row.type == 1 ? '自营业务线' : '合资公司' }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="function" label="职务" width="140">
        <template #default="{ row }">
          <span>{{ getFunctionText(row.function) }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="roleName" label="角色" width="200" />
      <ElTableColumn prop="deptName" label="部门" width="180" />
      <ElTableColumn prop="superiorName" label="上级姓名" width="160" />
      <ElTableColumn prop="superiorPhone" label="上级手机号" width="160" />
    </ElTable>

    <template #footer>
      <ElButton @click="handleClose">取 消</ElButton>
      <ElButton type="primary" @click="handleSave">确 定</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance } from 'element-plus'
  import { fetchAdminRoleAssignUser, fetchAdminUserBizList } from '@/api/system-manage'
  import { adminSysDictDetailGetDictDetailPage } from '@/api/sys'

  interface Props {
    modelValue: boolean
    roleId?: number | string
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const searchBarRef = ref<FormInstance>()
  const tableRef = ref()

  const form = reactive({
    name: '',
    function: '',
    page: 1,
    limit: 10000
  })

  const list = ref<any[]>([])
  const positionList = ref<{ label: string; value: string | number }[]>([])
  const selectedIds = ref<number[]>([])
  const selectedUsers = ref<any[]>([])
  const isFirstLoad = ref(true)
  const loading = ref(false)

  const searchItems = computed(() => [
    {
      label: '姓名',
      key: 'name',
      type: 'input',
      placeholder: '输入姓名',
      clearable: true
    },
    {
      label: '职务',
      key: 'function',
      type: 'select',
      props: {
        placeholder: '选择职务',
        options: positionList.value,
        clearable: true
      }
    }
  ])

  const fetchPositionList = async () => {
    const resp = await adminSysDictDetailGetDictDetailPage({
      dictName: 'business_function',
      page: 1,
      limit: 100
    })
    console.log('职务字典:', resp)
    if (resp && resp.list) {
      positionList.value = (resp.list || []).map((item: any) => ({
        label: item.label,
        value: item.value
      }))
    }
  }

  const getEmployeeList = async () => {
    loading.value = true
    try {
      const resp = await fetchAdminUserBizList(form)
      const data = resp?.list || (resp as any)?.data?.list || []
      list.value = data

      if (isFirstLoad.value && data.length) {
        // 初次加载时，根据用户已有的 roleId 预选中
        selectedUsers.value = data.filter((item: any) => {
          const roleIdStr = item.roleId ? String(item.roleId) : ''
          const ids = roleIdStr ? roleIdStr.split(',') : []
          return ids.includes(String(props.roleId ?? ''))
        })
        selectedIds.value = selectedUsers.value.map((item) => item.id)
      }

      isFirstLoad.value = false

      // 同步到表格选中状态
      nextTick(() => {
        tableRef.value?.clearSelection()
        const idIndexMap = new Map(list.value.map((item: any, idx: number) => [item.id, idx]))
        selectedIds.value.forEach((id) => {
          const idx = idIndexMap.get(id)
          if (idx !== undefined) {
            tableRef.value.toggleRowSelection(list.value[idx], true)
          }
        })
      })
    } catch (error) {
      console.error('获取员工列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 单行选择
  const selectRow = (selection: any[], row: any) => {
    const idx = selectedIds.value.indexOf(row.id)
    if (idx !== -1) {
      selectedIds.value.splice(idx, 1)
      selectedUsers.value.splice(idx, 1)
    } else {
      selectedIds.value.push(row.id)
      selectedUsers.value.push(row)
    }
  }

  // 全选/取消全选
  const selectAll = (selection: any[]) => {
    const ids = list.value.map((item) => item.id)

    if (selection.length === 0) {
      // 取消勾选当前页
      ids.forEach((id) => {
        const idx = selectedIds.value.indexOf(id)
        if (idx !== -1) {
          selectedIds.value.splice(idx, 1)
          selectedUsers.value.splice(idx, 1)
        }
      })
    } else {
      // 勾选当前页
      ids.forEach((id, index) => {
        const idx = selectedIds.value.indexOf(id)
        if (idx === -1) {
          selectedIds.value.push(id)
          selectedUsers.value.push(list.value[index])
        }
      })
    }
  }

  const handleSearch = async () => {
    await (searchBarRef.value as any)?.validate?.()
    await getEmployeeList()
  }

  const handleReset = async () => {
    form.name = ''
    form.function = ''
    await getEmployeeList()
  }

  const handleSave = async () => {
    const ids = selectedUsers.value.map((item) => item.id)
    await fetchAdminRoleAssignUser({
      roleId: props.roleId!,
      userIdList: ids
    })
    emit('success')
    handleClose()
  }

  const handleClose = () => {
    visible.value = false
    selectedIds.value = []
    selectedUsers.value = []
  }

  const getFunctionText = (type: any) => {
    const item = positionList.value.find((it) => Number(it.value) === Number(type))
    return item ? item.label : ''
  }

  watch(
    () => props.modelValue,
    async (val) => {
      if (val && props.roleId != null) {
        isFirstLoad.value = true
        selectedIds.value = []
        selectedUsers.value = []
        await fetchPositionList()
        await getEmployeeList()
      }
    }
  )
</script>
