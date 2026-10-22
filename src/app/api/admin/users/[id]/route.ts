import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { z } from 'zod'

const AdminUserUpdateSchema = z.object({
  plan: z.enum(['free', 'pro', 'elite']).optional(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
  isBanned: z.boolean().optional(),
  banReason: z.string().trim().max(500).nullable().optional(),
}).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const contentLength = Number(req.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = AdminUserUpdateSchema.safeParse(body)
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
      return NextResponse.json({ error: 'Invalid or empty user update' }, { status: 400 })
    }
    const { plan, role, isActive, isBanned, banReason } = parsed.data

    const targetUser = await db.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const removesAdminAccess = targetUser.role === 'admin'
      && (role === 'user' || isActive === false || isBanned === true)
    if (id === user.id && (role === 'user' || isActive === false || isBanned === true)) {
      return NextResponse.json({ error: 'You cannot remove your own administrator access' }, { status: 400 })
    }
    if (removesAdminAccess) {
      const otherActiveAdmins = await db.user.count({
        where: { id: { not: id }, role: 'admin', isActive: true, isBanned: false },
      })
      if (otherActiveAdmins === 0) {
        return NextResponse.json({ error: 'At least one active administrator must remain' }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (plan !== undefined) updateData.plan = plan
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    if (isBanned !== undefined) updateData.isBanned = isBanned
    if (banReason !== undefined) updateData.banReason = banReason

    const updated = await db.$transaction(async (tx) => {
      const changedUser = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        role: true,
        plan: true,
        isActive: true,
        isBanned: true,
        banReason: true,
        updatedAt: true,
        },
      })
      if (isActive === false || isBanned === true || role === 'user') {
        await tx.session.deleteMany({ where: { userId: id } })
      }
      return changedUser
    })

    return NextResponse.json({ user: updated }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Admin update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    const targetUser = await db.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (targetUser.role === 'admin') {
      return NextResponse.json({ error: 'Cannot deactivate an admin user' }, { status: 400 })
    }

    await db.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, message: 'User deactivated' })
  } catch (error) {
    console.error('Admin delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}