import request from '@/utils/http'
import { AppRouteRecord } from '@/types/router'

/**
 * ===== 后台用户管理（兼容旧项目 adminManagement） =====
 *
 * 所有接口、字段命名尽量与旧项目 `/src/views/admin/adminManagement` 保持一致，
 * 但通过统一的 http 封装与 useTable 进行适配。
 */

// 后台用户列表项（字段参考旧项目 AdminManagement）
export interface AdminUserItem {
  id: number
  account: string
  roleName?: string
  deptName?: string
  roleId?: number
  deptId?: number
  isForbidden?: boolean | string | number
  createTime?: string
  lastLoginTime?: string
}

// 后台用户搜索参数（旧项目使用 page / limit / account / phone）
export interface AdminUserSearchParams {
  page: number
  limit: number
  account?: string
  phone?: string
}

// 旧项目用户列表接口返回的数据结构 data
interface AdminUserListResponse {
  list: AdminUserItem[]
  totalCount: number
}

// 获取后台用户列表，对接旧接口 /admin/user/list/admin
export async function fetchAdminUserList(
  params: AdminUserSearchParams
): Promise<Api.Common.PaginatedResponse<AdminUserItem>> {
  const data = await request.post<AdminUserListResponse>({
    url: '/glk/admin/user/list/admin',
    params
  })

  return {
    records: data.list || [],
    total: data.totalCount ?? (data.list ? data.list.length : 0),
    current: params.page,
    size: params.limit
  }
}

// 修改用户状态 /admin/user/forbidden/admin
export function fetchChangeAdminUserStatus(data: { userId: number; isForbidden: string | number }) {
  return request.post<void>({
    url: '/glk/admin/user/forbidden/admin',
    data,
    showSuccessMessage: true
  })
}

// 重置用户密码 /admin/user/password/reset
export function fetchResetAdminUserPwd(data: { id: number }) {
  return request.post<void>({
    url: '/glk/admin/user/password/reset',
    data,
    showSuccessMessage: true
  })
}

// 新增后台用户 /admin/user/add
export function fetchAddAdminUser(data: {
  account: string
  roleId: number | string
  deptId: number | string
}) {
  return request.post<void>({
    url: '/glk/admin/user/add',
    data,
    showSuccessMessage: true
  })
}

// 编辑后台用户 /admin/user/update
export function fetchUpdateAdminUser(data: {
  userId: number | string
  account: string
  roleId: number | string
  deptId: number | string
}) {
  return request.post<void>({
    url: '/glk/admin/user/update',
    data,
    showSuccessMessage: true
  })
}

// 部门简易列表（用于“所属部门”下拉选择）
export interface AdminDeptItem {
  id: number
  deptName: string
}

export async function fetchAdminDeptList() {
  const list = await request.get<AdminDeptItem[]>({
    url: '/glk/admin/sys/dept/list'
  })
  return list
}

// 角色简易列表（用于“角色”下拉选择），对接旧接口 /admin/role/list
interface AdminRoleListResponse {
  list: {
    id: number
    name: string
    describes?: string
    dataScope?: number
    dataScopeDept?: string
  }[]
  totalCount: number
}

export async function fetchAdminRoleSimpleList() {
  const data = await request.post<AdminRoleListResponse>({
    url: '/admin/role/list',
    params: { page: 1, limit: 1000 }
  })
  return data.list || []
}

/**
 * ===== 角色管理（兼容旧项目 roleManagement） =====
 */

// 角色列表项（字段参考旧项目 RoleManagement）
export interface AdminRoleItem {
  id: number
  name: string
  describes?: string
  dataScope?: string | number
  dataScopeDept?: string
}

// 角色搜索/分页参数（旧项目：page/limit + name）
export interface AdminRoleSearchParams {
  page: number
  limit: number
  name?: string
}

// 旧项目角色列表接口返回结构
interface AdminRoleListResult {
  list: AdminRoleItem[]
  totalCount: number
}

// 获取角色列表，对接 /admin/role/list
export async function fetchAdminRoleList(
  params: AdminRoleSearchParams
): Promise<Api.Common.PaginatedResponse<AdminRoleItem>> {
  const data = await request.post<AdminRoleListResult>({
    url: '/glk/admin/role/list',
    params
  })

  return {
    records: data.list || [],
    total: data.totalCount ?? (data.list ? data.list.length : 0),
    current: params.page,
    size: params.limit
  }
}

// 新增/编辑角色 /admin/role/addAndUpdate
export function fetchAdminRoleSaveOrUpdate(data: {
  id?: number | string
  name: string
  describes?: string
  menuIdList?: (number | string)[]
  dataScope?: string | number
  dataScopeDept?: string
}) {
  return request.post<void>({
    url: '/glk/admin/role/addAndUpdate',
    data,
    showSuccessMessage: false
  })
}

// 删除角色 /admin/role/delete
export function fetchAdminRoleDelete(data: { id?: number | string; ids?: string }) {
  return request.post<void>({
    url: '/glk/admin/role/delete',
    data
  })
}

// 根据角色获取菜单树 /admin/menu/getMenuAllByRole
export function fetchMenuByRole(data: { id: number | string }) {
  return request.post<any>({
    url: '/glk/admin/menu/getMenuAllByRole',
    data
  })
}

// 获取全部菜单树（用于角色菜单权限）
export function fetchAllMenus() {
  return request.post<any>({
    url: '/glk/admin/menu/getMenuAll'
  })
}

// 机构树（数据权限使用）
export function fetchDeptTree() {
  return request.get<any>({
    url: '/glk/admin/sys/dept/treeList'
  })
}

// 角色关联员工：/admin/role/assignUser
export function fetchAdminRoleAssignUser(data: { roleId: string | number; userIdList: number[] }) {
  return request.post<void>({
    url: '/glk/admin/role/assignUser',
    data,
    showSuccessMessage: true
  })
}

// 业务员工列表：/admin/user/list/biz
export function fetchAdminUserBizList(params: any) {
  return request.post<{ list: any[] }>({
    url: '/glk/admin/user/list/biz',
    params
  })
}

// ==================== 下面是原有示例接口，保留兼容 ====================
// 获取用户列表（示例接口，保留）
export function fetchGetUserList(params: Api.SystemManage.UserSearchParams) {
  return request.get<Api.SystemManage.UserList>({
    url: '/api/user/list',
    params
  })
}

// 获取角色列表（示例接口，保留）
export function fetchGetRoleList(params: Api.SystemManage.RoleSearchParams) {
  return request.get<Api.SystemManage.RoleList>({
    url: '/api/role/list',
    params
  })
}

// ===== 菜单管理（兼容旧项目 menuManagement） =====

export interface AdminMenuItem {
  id: number
  pid?: number
  name: string
  path: string
  describes?: string
  sort?: number
  menuType?: number // 1 菜单  2 按钮  等
  childMenu?: AdminMenuItem[]
}

// 获取菜单树（带子节点），对接 /admin/menu/getMenuAllHasChild
export async function fetchAdminMenuTree(params?: { page?: number; limit?: number }) {
  const res = await request.post<AdminMenuItem[]>({
    url: '/glk/admin/menu/getMenuAllHasChild',
    params
  })
  return (res as any)?.data || (res as any) || []
}

// 新增/编辑菜单 /admin/menu/addAndUpdate
export function fetchAdminMenuSaveOrUpdate(data: Partial<AdminMenuItem> & { menuType?: number }) {
  return request.post<void>({
    url: '/glk/admin/menu/addAndUpdate',
    data
  })
}

// 删除菜单 /admin/menu/delete
export function fetchAdminMenuDelete(data: { id?: number | string; ids?: string }) {
  return request.post<void>({
    url: '/glk/admin/menu/delete',
    data
  })
}

// ==================== 下面是原有示例接口，保留兼容 ====================

// 获取菜单列表（示例）
export function fetchGetMenuList() {
  return request.post<AppRouteRecord[]>({
    url: '/glk/admin/menu/getRouteByRole'
  })
}
