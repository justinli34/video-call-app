"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Check } from "lucide-react"
import { io, type Socket } from "socket.io-client"
import { toast } from "@/components/ui/use-toast"

export default function Room() {
  const { roomId } = useParams()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [copied, setCopied] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({})

  // Initialize socket connection and local media
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_SERVER || "http://localhost:3001")
    setSocket(newSocket)

    // Get local media stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Join room
        newSocket.emit("join-room", roomId)
      })
      .catch((error) => {
        console.error("Error accessing media devices:", error)
        toast({
          title: "Camera/Microphone Error",
          description: "Could not access your camera or microphone. Please check permissions.",
          variant: "destructive",
        })
      })

    return () => {
      // Clean up
      localStream?.getTracks().forEach((track) => track.stop())
      Object.values(peerConnections.current).forEach((pc) => pc.close())
      newSocket.disconnect()
    }
  }, [roomId])

  // Socket event handlers
  useEffect(() => {
    if (!socket || !localStream) return

    // When a new user joins the room
    socket.on("user-connected", (userId) => {
      console.log("User connected:", userId)
      setParticipants((prev) => [...prev, userId])
      connectToNewUser(userId, localStream)
    })

    // When a user leaves the room
    socket.on("user-disconnected", (userId) => {
      console.log("User disconnected:", userId)
      setParticipants((prev) => prev.filter((id) => id !== userId))
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close()
        delete peerConnections.current[userId]
      }
      setRemoteStreams((prev) => {
        const newStreams = { ...prev }
        delete newStreams[userId]
        return newStreams
      })
    })

    // WebRTC signaling
    socket.on("offer", async ({ offer, from }) => {
      console.log("Received offer from:", from)
      const pc = createPeerConnection(from)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit("answer", { answer, to: from })
    })

    socket.on("answer", ({ answer, from }) => {
      console.log("Received answer from:", from)
      const pc = peerConnections.current[from]
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(answer))
      }
    })

    socket.on("ice-candidate", ({ candidate, from }) => {
      console.log("Received ICE candidate from:", from)
      const pc = peerConnections.current[from]
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    })

    return () => {
      socket.off("user-connected")
      socket.off("user-disconnected")
      socket.off("offer")
      socket.off("answer")
      socket.off("ice-candidate")
    }
  }, [socket, localStream, roomId])

  // Create a peer connection for a new user
  const createPeerConnection = (userId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    // Add local tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream)
      })
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit("ice-candidate", {
          candidate: event.candidate,
          to: userId,
        })
      }
    }

    // Handle incoming streams
    pc.ontrack = (event) => {
      console.log("Received remote track from:", userId)
      setRemoteStreams((prev) => ({
        ...prev,
        [userId]: event.streams[0],
      }))
    }

    peerConnections.current[userId] = pc
    return pc
  }

  // Connect to a new user
  const connectToNewUser = async (userId: string, stream: MediaStream) => {
    console.log("Connecting to new user:", userId)
    const pc = createPeerConnection(userId)

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket?.emit("offer", { offer, to: userId })
    } catch (error) {
      console.error("Error creating offer:", error)
    }
  }

  // Toggle microphone
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsMuted(!isMuted)
    }
  }

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsVideoOff(!isVideoOff)
    }
  }

  // Copy room ID to clipboard
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId as string)
    setCopied(true)
    toast({
      title: "Room ID copied!",
      description: "Share this with others to invite them to the call.",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  // Leave the room
  const leaveRoom = () => {
    window.location.href = "/"
  }

  return (
    <main className="flex min-h-screen flex-col p-4 bg-gradient-to-b from-blue-50 to-blue-100">
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <CardTitle className="text-xl">Room: {roomId}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyRoomId} className="flex items-center gap-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy ID"}
            </Button>
            <Button variant="destructive" size="sm" onClick={leaveRoom} className="flex items-center gap-1">
              <PhoneOff className="h-4 w-4" />
              Leave
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
        {/* Local video */}
        <Card className="overflow-hidden">
          <CardContent className="p-0 relative">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-md" />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="icon"
                onClick={toggleMute}
                className="rounded-full"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                variant={isVideoOff ? "destructive" : "secondary"}
                size="icon"
                onClick={toggleVideo}
                className="rounded-full"
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            </div>
            <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">You</div>
          </CardContent>
        </Card>

        {/* Remote videos */}
        {Object.entries(remoteStreams).map(([userId, stream]) => (
          <Card key={userId} className="overflow-hidden">
            <CardContent className="p-0 relative">
              <RemoteVideo stream={stream} />
              <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">Participant</div>
            </CardContent>
          </Card>
        ))}

        {/* Placeholder for when no one has joined */}
        {Object.keys(remoteStreams).length === 0 && (
          <Card className="flex items-center justify-center">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-medium mb-2">Waiting for others to join...</h3>
              <p className="text-muted-foreground">Share the room ID with others to invite them to this call.</p>
              <Button variant="outline" onClick={copyRoomId} className="mt-4 flex items-center gap-1">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy Room ID"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

// Component for remote video
function RemoteVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover rounded-md" />
}

