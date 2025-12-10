import request from '@/utils/http'

/**
 * 系统相关 API（兼容旧项目 /admin/sys/* 接口）
 */

/**
 * 字典明细分页查询
 * 对应旧项目接口：/admin/sys/dictDetail/getDictDetailPage
 */
export function adminSysDictDetailGetDictDetailPage(params: {
  dictName: string
  page: number
  limit: number
}) {
  return request.get<any>({
    url: '/glk/admin/sys/dictDetail/getDictDetailPage',
    params
  })
}
