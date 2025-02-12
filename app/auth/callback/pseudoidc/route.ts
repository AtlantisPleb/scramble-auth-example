import { auth } from "auth"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  return await auth(request)