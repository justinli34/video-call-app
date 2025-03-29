"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

export default function Home() {
  const [roomId, setRoomId] = useState("")
  const router = useRouter()

  const createRoom = () => {
    // Generate a random room ID
    const newRoomId = Math.random().toString(36).substring(2, 7)
    router.push(`/room/${newRoomId}`)
  }

  const joinRoom = () => {
    if (roomId.trim()) {
      router.push(`/room/${roomId}`)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-50 to-blue-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Video Call App</CardTitle>
          <CardDescription>Create or join a room to start a video call</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={createRoom} className="w-full bg-blue-600 hover:bg-blue-700">
            Create New Room
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or join existing room</span>
            </div>
          </div>
          <div className="flex space-x-2">
            <Input type="text" placeholder="Enter Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
            <Button onClick={joinRoom} variant="outline">
              Join
            </Button>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-center text-muted-foreground">
          No login required. Just create or join a room to get started.
        </CardFooter>
      </Card>
    </main>
  )
}

