<!-- 角色管理页面 -->
<template>
  <div class="art-full-height">
    <RoleSearch
      v-show="showSearchBar"
      v-model="searchForm"
      @search="handleSearch"
      @reset="resetSearchParams"
    ></RoleSearch>

    <ElCard
      class="art-table-card"
      shadow="never"
      :style="{ 'margin-top': showSearchBar ? '12px' : '0' }"
    >
      <ArtTableHeader
        v-model:columns="columnChecks"
        v-model:showSearchBar="showSearchBar"
        :loading="loading"
        @refresh="refreshData"
      >
        <template #left>
          <ElSpace wrap>
            <ElButton @click="showDialog('add')" v-ripple>新增角色</ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <!-- 表格 -->
      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>
    </ElCard>

    <!-- 角色编辑弹窗 -->
    <RoleEditDialog
      v-model="dialogVisible"
      :dialog-type="dialogType"
      :role-data="currentRoleData"
      @success="refreshData"
    />

    <!-- 菜单+数据权限弹窗（根据旧项目，实际可以合并在编辑里，这里暂保留单独权限配置） -->
    <RolePermissionDialog
      v-model="permissionDialog"
      :role-data="currentRoleData"
      @success="refreshData"
    />

    <!-- 关联员工弹窗 -->
    <RoleEmployeeDialog
      v-model="employeeDialog"
      :role-id="currentRoleData?.id"
      @success="refreshData"
    />
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchAdminRoleList,
    type AdminRoleItem,
    type AdminRoleSearchParams,
    fetchAdminRoleDelete
  } from '@/api/system-manage'
  import RoleSearch from './modules/role-search.vue'
  import RoleEditDialog from './modules/role-edit-dialog.vue'
  import RolePermissionDialog from './modules/role-permission-dialog.vue'
  import RoleEmployeeDialog from './modules/role-employee-dialog.vue'
  import { ElMessageBox } from 'element-plus'

  defineOptions({ name: 'Role' })

  type RoleListItem = AdminRoleItem

  // 搜索表单
  const searchForm = ref<Pick<AdminRoleSearchParams, 'name'>>({
    name: ''
  })

  // 默认显示搜索栏
  const showSearchBar = ref(true)

  const dialogVisible = ref(false)
  const permissionDialog = ref(false)
  const employeeDialog = ref(false)
  const currentRoleData = ref<RoleListItem | undefined>(undefined)

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
    refreshData
  } = useTable({
    // 核心配置
    core: {
      apiFn: fetchAdminRoleList,
      apiParams: {
        page: 1,
        limit: 20,
        ...searchForm.value
      } as AdminRoleSearchParams,
      // 分页字段与旧项目保持一致：page / limit
      paginationKey: {
        current: 'page',
        size: 'limit'
      },
      columnsFactory: () => [
        {
          prop: 'id',
          label: 'ID',
          width: 80
        },
        {
          prop: 'name',
          label: '角色名称',
          minWidth: 120
        },
        {
          prop: 'describes',
          label: '角色描述',
          minWidth: 150,
          showOverflowTooltip: true
        },
        {
          prop: 'operation',
          label: '操作',
          width: 200,
          fixed: 'right',
          formatter: (row: RoleListItem) =>
            h('div', { class: 'flex items-center gap-2' }, [
              // 编辑
              h(
                ElButton,
                {
                  type: 'primary',
                  link: true,
                  size: 'small',
                  disabled: row.name === 'admin',
                  onClick: () => {
                    if (row.name === 'admin') return
                    showDialog('edit', row)
                  }
                },
                () => '编辑'
              ),
              // 删除
              h(
                ElButton,
                {
                  type: 'danger',
                  link: true,
                  size: 'small',
                  disabled: row.name === 'admin',
                  onClick: () => {
                    if (row.name === 'admin') return
                    deleteRole(row)
                  }
                },
                () => '删除'
              ),
              // 关联员工
              h(
                ElButton,
                {
                  type: 'primary',
                  link: true,
                  size: 'small',
                  disabled: row.name === 'admin',
                  onClick: () => {
                    if (row.name === 'admin') return
                    showEmployeeDialog(row)
                  }
                },
                () => '关联员工'
              )
            ])
        }
      ]
    }
  })

  const dialogType = ref<'add' | 'edit'>('add')

  const showDialog = (type: 'add' | 'edit', row?: RoleListItem) => {
    dialogVisible.value = true
    dialogType.value = type
    currentRoleData.value = row
  }

  /**
   * 搜索处理
   * @param params 搜索参数
   */
  const handleSearch = (params: Record<string, any>) => {
    // 旧项目只按角色名称 name 查询
    Object.assign(searchParams, { page: 1, limit: pagination.size, name: params.name || '' })
    getData()
  }

  const showEmployeeDialog = (row?: RoleListItem) => {
    employeeDialog.value = true
    currentRoleData.value = row
  }

  const deleteRole = (row: RoleListItem) => {
    if (row.name === 'admin') return

    ElMessageBox.confirm(`确定删除角色"${row.name}"吗？此操作不可恢复！`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchAdminRoleDelete({ id: row.id })
        ElMessage.success('删除成功')
        refreshData()
      })
      .catch(() => {
        ElMessage.info('已取消删除')
      })
  }
</script>
