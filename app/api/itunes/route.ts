import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")
  const media = "music"
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10))

  if (!query) {
    return NextResponse.json({ results: [] })
  }

  try {
    const params = new URLSearchParams({
      term: query,
      media,
      entity: "song",
      limit: String(limit),
    })
    const url = `https://itunes.apple.com/search?${params.toString()}`

    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    if (!response.ok) {
      return NextResponse.json({ results: [], error: `iTunes API error: ${response.status}` }, { status: 500 })
    }

    const data = await response.json()

    const tracks = (data.results || [])
      .filter((item: any) => item.previewUrl)
      .map((item: any) => ({
        id: String(item.trackId),
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName,
        previewUrl: item.previewUrl,
        duration: Math.floor((item.trackTimeMillis || 30000) / 1000),
        artwork: item.artworkUrl100 || item.artworkUrl60 || item.artworkUrl30 || "",
      }))

    return NextResponse.json({ results: tracks })
  } catch (error) {
    return NextResponse.json({ results: [], error: "Failed to search" }, { status: 500 })
  }
}
