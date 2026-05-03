export type PopularArtist = {
  name: string
  image: string
  query: string
}

export const POPULAR_ARTISTS: PopularArtist[] = [
  { name: "Kendrick Lamar", image: "/artist-kendrick-lamar.png", query: "kendrick lamar" },
  { name: "Drake", image: "/artist-drake.png", query: "drake" },
  { name: "The Weeknd", image: "/artist-the-weeknd.png", query: "the weeknd" },
  { name: "Morgan Wallen", image: "/artist-morgan-wallen.png", query: "morgan wallen" },
  { name: "Post Malone", image: "/artist-post-malone.png", query: "post malone" },
  { name: "Rihanna", image: "/artist-rihanna.png", query: "rihanna" },
]
