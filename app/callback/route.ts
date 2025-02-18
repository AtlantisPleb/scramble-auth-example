import { auth } from "auth"
import { redirect } from "next/navigation"

export async function GET(request: Request) {
  const authResult = await auth()
  
  // After successful authentication, redirect to home page
  redirect("/")
}