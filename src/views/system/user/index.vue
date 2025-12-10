<!-- 用户管理页面 -->
<!-- art-full-height 自动计算出页面剩余高度 -->
<!-- art-table-card 一个符合系统样式的 class，同时自动撑满剩余高度 -->
<!-- 更多 useTable 使用示例请移步至 功能示例 下面的 高级表格示例或者查看官方文档 -->
<!-- useTable 文档：https://www.artd.pro/docs/zh/guide/hooks/use-table.html -->
<template>
  <div class="user-page art-full-height">
    <!-- 搜索栏 -->
    <UserSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams"></UserSearch>

    <ElCard class="art-table-card" shadow="never">
      <!-- 表格头部 -->
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton @click="showDialog('add')" v-ripple>新增用户</ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <!-- 表格 -->
      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>

      <!-- 用户弹窗 -->
      <UserDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :user-data="currentUserData"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchAdminUserList,
    type AdminUserItem,
    type AdminUserSearchParams,
    fetchChangeAdminUserStatus,
    fetchResetAdminUserPwd
  } from '@/api/system-manage'
  import { formatDateTime } from '@/utils'
  import UserSearch from './modules/user-search.vue'
  import UserDialog from './modules/user-dialog.vue'
  import { ElButton, ElSwitch, ElMessageBox } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'User' })

  type UserListItem = AdminUserItem

  // 弹窗相关
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentUserData = ref<Partial<UserListItem>>({})

  // 选中行
  const selectedRows = ref<UserListItem[]>([])

  // 搜索表单（字段参考旧项目 AdminManagement：account、phone）
  const searchForm = ref<Pick<AdminUserSearchParams, 'account' | 'phone'>>({
    account: '',
    phone: ''
  })

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    searchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    refreshUpdate
  } = useTable({
    // 核心配置
    core: {
      apiFn: fetchAdminUserList,
      apiParams: {
        page: 1,
        limit: 20,
        ...searchForm.value
      } as AdminUserSearchParams,
      // 旧项目分页字段：page / limit
      paginationKey: {
        current: 'page',
        size: 'limit'
      },
      columnsFactory: () => [
        { type: 'selection' },
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'id',
          label: 'ID',
          width: 80
        },
        {
          prop: 'account',
          label: '用户名',
          minWidth: 150
        },
        {
          prop: 'roleName',
          label: '用户角色',
          minWidth: 150,
          showOverflowTooltip: true
        },
        {
          prop: 'deptName',
          label: '部门',
          minWidth: 150,
          showOverflowTooltip: true
        },
        {
          prop: 'isForbidden',
          label: '状态',
          width: 120,
          formatter: (row: UserListItem) =>
            h(ElSwitch, {
              modelValue: row.isForbidden,
              'onUpdate:modelValue': () => {},
              activeValue: false,
              inactiveValue: true,
              onChange: () => handleStatusChange(row)
            })
        },
        {
          prop: 'createTime',
          label: '创建时间',
          width: 180,
          sortable: true,
          formatter: (row: UserListItem) => formatDateTime(row.createTime)
        },
        {
          prop: 'lastLoginTime',
          label: '最近登录时间',
          width: 180,
          sortable: true,
          formatter: (row: UserListItem) => formatDateTime(row.lastLoginTime)
        },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: UserListItem) =>
            h('div', { class: 'flex items-center gap-2' }, [
              h(
                ElButton,
                {
                  type: 'primary',
                  link: true,
                  size: 'small',
                  onClick: () => resetPwd(row)
                },
                () => '重置密码'
              ),
              h(
                ElButton,
                {
                  type: 'primary',
                  link: true,
                  size: 'small',
                  disabled: row.account === 'admin',
                  style:
                    row.account === 'admin'
                      ? 'opacity: 0.4; cursor: not-allowed;'
                      : 'cursor: pointer;',
                  onClick: () => {
                    if (row.account === 'admin') return
                    showDialog('edit', row)
                  }
                },
                () => '编辑'
              )
            ])
        }
      ]
    }
  })

  /**
   * 搜索处理
   * @param params 参数
   */
  const handleSearch = (params: Record<string, any>) => {
    // 同步外部搜索表单
    Object.assign(searchForm.value, params)
    // 同步给 useTable 内部的 searchParams，并重置到第一页
    Object.assign(searchParams, {
      page: 1,
      limit: pagination.size,
      ...searchForm.value
    })
    getData()
  }

  /**
   * 显示用户弹窗
   */
  const showDialog = (type: DialogType, row?: UserListItem): void => {
    dialogType.value = type
    currentUserData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  /**
   * 处理弹窗提交事件（新增/编辑成功后刷新列表）
   */
  const handleDialogSubmit = async () => {
    dialogVisible.value = false
    currentUserData.value = {}
    await refreshUpdate()
  }

  /**
   * 重置密码
   */
  const resetPwd = async (row: UserListItem) => {
    await ElMessageBox.confirm(`确定要重置用户“${row.account}”的密码吗？`, '重置密码', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await fetchResetAdminUserPwd({ id: row.id })
    await refreshUpdate()
  }

  /**
   * 修改用户状态（启用 / 禁用），逻辑参考旧项目 adminManagement
   */
  const handleStatusChange = async (row: UserListItem) => {
    await ElMessageBox.confirm('确定要改变当前用户状态吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    let userStatus: string | number
    if (row.isForbidden) {
      // 旧项目逻辑：当前为禁用(true) -> 传 0 表示启用
      userStatus = '0'
    } else {
      // 当前为启用(false) -> 传 1 表示禁用
      userStatus = '1'
    }

    await fetchChangeAdminUserStatus({
      userId: row.id,
      isForbidden: userStatus
    })
    await refreshUpdate()
  }

  /**
   * 处理表格行选择变化
   */
  const handleSelectionChange = (selection: UserListItem[]): void => {
    selectedRows.value = selection
  }
</script>
