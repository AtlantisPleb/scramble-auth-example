import { auth } from "auth"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const response = await auth(request)
    return response
  } catch (error) {
    console.error('Auth callback error:', error)
    return new Response(null, { status: 500 })
  }
}