import { execFile, execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { join } from 'node:path'
import { app } from 'electron'

import { loadConfig } from './config'
import type { LyricLine, MpdSong, MpdStatus, PlaybackMode } from '../types/music'

/**
 * 缓存的本地曲库数据，避免每次展开抽屉都重新全量查询
 */
let cachedSongs: MpdSong[] | null = null

/**
 * 缓存的歌词解析结果 (以 relPath 为 key)
 */
const cachedLyrics = new Map<string, LyricLine[]>()

/**
 * 执行原生 MPD 纯文本 TCP 协议指令
 *
 * @param command 要发送给 MPD 的命令文本 (末尾自动补齐 \n)
 * @param timeoutMs 指令超时时间，默认 6000ms
 */
export function sendMpdCommand(command: string, timeoutMs = 6000): Promise<string> {
  const config = loadConfig()
  const { host, port } = config.mpd

  return new Promise((resolve, reject) => {
    let buffer = ''
    let isFinished = false

    const socket = net.createConnection({ host, port }, () => {
      const payload = command.endsWith('\n') ? command : `${command}\n`
      socket.write(payload)
    })

    const cleanup = (): void => {
      if (!isFinished) {
        isFinished = true
        socket.destroy()
      }
    }

    socket.setTimeout(timeoutMs, () => {
      cleanup()
      reject(new Error(`[lpip-player:mpd] 指令执行超时: ${command.trim()}`))
    })

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8')
      // MPD 协议规范: 成功以 \nOK\n (或行末 OK\n) 终止; 错误以 ACK [error] 终止
      if (
        buffer.includes('\nOK\n') ||
        buffer.endsWith('OK\n') ||
        buffer.includes('\nACK ') ||
        buffer.startsWith('ACK ')
      ) {
        cleanup()
        resolve(buffer)
      }
    })

    socket.on('error', (err) => {
      cleanup()
      reject(err)
    })

    socket.on('end', () => {
      cleanup()
      resolve(buffer)
    })
  })
}

/**
 * 从文件路径和元数据推导音质评级
 * - Hi-Res: 采样率 >= 88200Hz 或 24bit 位深
 * - SQ: 无损 16bit FLAC / WAV
 * - HQ: 320k 码率 MP3 等高质有损
 * - STD: 标准音频
 */
export function deriveAudioQuality(format: string, ext: string): 'Hi-Res' | 'SQ' | 'HQ' | 'STD' {
  if (format.includes(':24:') || format.includes(':32:')) {
    return 'Hi-Res'
  }
  const sampleRateMatch = format.match(/^(\d+):/)
  if (sampleRateMatch) {
    const sampleRate = Number.parseInt(sampleRateMatch[1], 10)
    if (sampleRate >= 88200) {
      return 'Hi-Res'
    }
  }

  const cleanExt = ext.toLowerCase()
  if (cleanExt === '.flac' || cleanExt === '.wav' || cleanExt === '.alac' || format.includes(':16:2')) {
    return 'SQ'
  }

  if (cleanExt === '.mp3') {
    return 'HQ'
  }

  return 'STD'
}

/**
 * 解析 MPD `listallinfo` 指令返回的纯文本内容为结构化歌曲对象
 */
export function parseMpdLibrary(raw: string): MpdSong[] {
  const lines = raw.split('\n')
  const songs: MpdSong[] = []
  let cur: Partial<MpdSong> | null = null

  for (const line of lines) {
    if (line.startsWith('file: ')) {
      if (cur && cur.file) {
        songs.push(finalizeSong(cur))
      }
      const file = line.slice(6).trim()
      cur = {
        id: file,
        file,
        title: '',
        artist: '',
        album: '',
        duration: 0,
        format: '',
        quality: 'STD',
        coverUrl: `app-media://cover/${encodeURIComponent(file)}`
      }
    } else if (cur) {
      const idx = line.indexOf(': ')
      if (idx !== -1) {
        const key = line.slice(0, idx).toLowerCase()
        const val = line.slice(idx + 2).trim()
        if (key === 'title') cur.title = val
        else if (key === 'artist') cur.artist = val
        else if (key === 'album') cur.album = val
        else if (key === 'duration') cur.duration = Number.parseFloat(val) || 0
        else if (key === 'time' && !cur.duration) cur.duration = Number.parseInt(val, 10) || 0
        else if (key === 'format') cur.format = val
        else if (key === 'date') cur.date = val
        else if (key === 'track') cur.track = val
      }
    }
  }

  if (cur && cur.file) {
    songs.push(finalizeSong(cur))
  }

  return songs
}

/**
 * 兜底修饰歌曲缺失的标题与艺术家
 */
function finalizeSong(item: Partial<MpdSong>): MpdSong {
  const file = item.file || ''
  const dot = file.lastIndexOf('.')
  const ext = dot !== -1 ? file.slice(dot) : ''
  const format = item.format || ''
  const quality = deriveAudioQuality(format, ext)

  let title = item.title ? item.title.trim() : ''
  let artist = item.artist ? item.artist.trim() : ''
  const album = item.album ? item.album.trim() : '未知专辑'

  // 如果标签缺少标题或歌手，从文件名中推测 (如 "1874 - 陈奕迅.flac")
  if (!title) {
    const filename = file.split('/').pop() || file
    const baseName = filename.replace(/\.[^/.]+$/, '')
    const parts = baseName.split(' - ')
    if (parts.length >= 2) {
      title = parts[0].trim()
      if (!artist) {
        artist = parts[1].trim()
      }
    } else {
      title = baseName
    }
  }

  if (!artist) {
    artist = '未知歌手'
  }

  return {
    id: item.id || file,
    file,
    title,
    artist,
    album,
    duration: item.duration || 0,
    format,
    quality,
    coverUrl: item.coverUrl || `app-media://cover/${encodeURIComponent(file)}`,
    date: item.date,
    track: item.track,
    pos: item.pos,
    queueId: item.queueId
  }
}

/**
 * 解析 MPD `playlistinfo` 指令返回的纯文本内容为结构化歌曲对象队列
 */
export function parseMpdPlaylist(raw: string): MpdSong[] {
  const lines = raw.split('\n')
  const songs: MpdSong[] = []
  let cur: Partial<MpdSong> | null = null

  for (const line of lines) {
    if (line.startsWith('file: ')) {
      if (cur && cur.file) {
        songs.push(finalizeSong(cur))
      }
      const file = line.slice(6).trim()
      cur = {
        id: file,
        file,
        title: '',
        artist: '',
        album: '',
        duration: 0,
        format: '',
        quality: 'STD',
        coverUrl: `app-media://cover/${encodeURIComponent(file)}`
      }
    } else if (cur) {
      const idx = line.indexOf(': ')
      if (idx !== -1) {
        const key = line.slice(0, idx).toLowerCase()
        const val = line.slice(idx + 2).trim()
        if (key === 'title') cur.title = val
        else if (key === 'artist') cur.artist = val
        else if (key === 'album') cur.album = val
        else if (key === 'duration') cur.duration = Number.parseFloat(val) || 0
        else if (key === 'time' && !cur.duration) cur.duration = Number.parseInt(val, 10) || 0
        else if (key === 'format') cur.format = val
        else if (key === 'date') cur.date = val
        else if (key === 'track') cur.track = val
        else if (key === 'pos') cur.pos = Number.parseInt(val, 10)
        else if (key === 'id') {
          cur.queueId = Number.parseInt(val, 10)
          cur.id = `q_${cur.queueId}`
        }
      }
    }
  }

  if (cur && cur.file) {
    songs.push(finalizeSong(cur))
  }

  return songs
}

/**
 * 获取本地曲库全部音源列表 (优先使用内存缓存)
 */
export async function getLibrary(): Promise<MpdSong[]> {
  if (cachedSongs && cachedSongs.length > 0) {
    return cachedSongs
  }

  try {
    const raw = await sendMpdCommand('listallinfo')
    cachedSongs = parseMpdLibrary(raw)
    return cachedSongs
  } catch (error) {
    console.error('[lpip-player:mpd] 获取曲库失败:', error)
    return []
  }
}

/**
 * 触发 MPD 曲库重新扫描并刷新缓存
 */
export async function rescanLibrary(): Promise<MpdSong[]> {
  cachedSongs = null
  try {
    await sendMpdCommand('update')
    // 稍微等待 MPD 后端刷新数据库索引
    await new Promise((resolve) => setTimeout(resolve, 400))
    const raw = await sendMpdCommand('listallinfo')
    cachedSongs = parseMpdLibrary(raw)
    return cachedSongs
  } catch (error) {
    console.error('[lpip-player:mpd] 重新扫描曲库失败:', error)
    return []
  }
}

/**
 * 解析 MPD 实时播放状态与当前播放曲目
 */
export async function getStatus(): Promise<MpdStatus> {
  try {
    const raw = await sendMpdCommand('status\ncurrentsong\n')
    const lines = raw.split('\n')

    let repeat = false
    let random = false
    let single = false

    const result: MpdStatus = {
      state: 'stop',
      volume: 100,
      currentTime: 0,
      duration: 0,
      currentSong: null,
      playlistLength: 0,
      songPos: 0,
      repeat: false,
      random: false,
      single: false,
      mode: 'sequence'
    }

    let inSong = false
    const songData: Record<string, string> = {}

    for (const line of lines) {
      if (line.startsWith('file: ')) {
        inSong = true
        songData['file'] = line.slice(6).trim()
      } else if (inSong) {
        const idx = line.indexOf(': ')
        if (idx !== -1) {
          const k = line.slice(0, idx).toLowerCase()
          const v = line.slice(idx + 2).trim()
          songData[k] = v
        }
      } else {
        const idx = line.indexOf(': ')
        if (idx !== -1) {
          const k = line.slice(0, idx).toLowerCase()
          const v = line.slice(idx + 2).trim()
          if (k === 'state') {
            result.state = v === 'play' ? 'play' : v === 'pause' ? 'pause' : 'stop'
          } else if (k === 'volume') {
            result.volume = Number.parseInt(v, 10) || 100
          } else if (k === 'elapsed') {
            result.currentTime = Number.parseFloat(v) || 0
          } else if (k === 'duration') {
            result.duration = Number.parseFloat(v) || 0
          } else if (k === 'playlistlength') {
            result.playlistLength = Number.parseInt(v, 10) || 0
          } else if (k === 'song') {
            result.songPos = Number.parseInt(v, 10) || 0
          } else if (k === 'songid') {
            result.songId = Number.parseInt(v, 10) || 0
          } else if (k === 'repeat') {
            repeat = v === '1'
          } else if (k === 'random') {
            random = v === '1'
          } else if (k === 'single') {
            single = v === '1'
          }
        }
      }
    }

    result.repeat = repeat
    result.random = random
    result.single = single

    if (single) {
      result.mode = 'single'
    } else if (random) {
      result.mode = 'shuffle'
    } else {
      result.mode = 'sequence'
    }

    if (songData['file']) {
      const qId = songData['id'] ? Number.parseInt(songData['id'], 10) : result.songId
      result.currentSong = finalizeSong({
        id: songData['file'],
        file: songData['file'],
        title: songData['title'],
        artist: songData['artist'],
        album: songData['album'],
        duration: Number.parseFloat(songData['duration']) || result.duration,
        format: songData['format'],
        date: songData['date'],
        track: songData['track'],
        pos: songData['pos'] ? Number.parseInt(songData['pos'], 10) : result.songPos,
        queueId: qId
      })
    }

    return result
  } catch (error) {
    console.error('[lpip-player:mpd] 查询状态失败:', error)
    return {
      state: 'stop',
      volume: 100,
      currentTime: 0,
      duration: 0,
      currentSong: null,
      playlistLength: 0,
      songPos: 0,
      repeat: false,
      random: false,
      single: false,
      mode: 'sequence'
    }
  }
}

/**
 * 确保 MPD 当前播放队列已预填充全部目录
 */
async function ensureQueuePopulated(): Promise<void> {
  try {
    const status = await getStatus()
    if (status.playlistLength === 0) {
      await sendMpdCommand('add "music_1"\nadd "music_2"\nadd "music_3"\nadd "music_4"')
    }
  } catch {
    // 忽略预载错误
  }
}

/**
 * 播放指定音源文件 (若在队列中则跳播，否则加入后播放)
 */
export async function playSong(file: string): Promise<boolean> {
  try {
    await ensureQueuePopulated()

    // 检查当前队列是否已包含此曲
    const findRes = await sendMpdCommand(`playlistfind "file" "${file}"`)
    const idMatch = findRes.match(/Id:\s*(\d+)/i)

    if (idMatch) {
      const songId = idMatch[1]
      await sendMpdCommand(`playid ${songId}`)
    } else {
      await sendMpdCommand(`command_list_begin\nadd "${file}"\nplay\ncommand_list_end`)
    }
    return true
  } catch (error) {
    console.error(`[lpip-player:mpd] 播放歌曲失败: ${file}`, error)
    return false
  }
}

/**
 * 暂停播放
 */
export async function pausePlayback(): Promise<boolean> {
  try {
    await sendMpdCommand('pause 1')
    return true
  } catch (error) {
    console.error('[lpip-player:mpd] 暂停失败:', error)
    return false
  }
}

/**
 * 恢复播放
 */
export async function resumePlayback(): Promise<boolean> {
  try {
    await sendMpdCommand('pause 0')
    return true
  } catch (error) {
    console.error('[lpip-player:mpd] 恢复播放失败:', error)
    return false
  }
}

/**
 * 切换播放/暂停状态
 */
export async function togglePlayPause(): Promise<'play' | 'pause' | 'stop'> {
  try {
    const status = await getStatus()
    if (status.state === 'play') {
      await sendMpdCommand('pause 1')
      return 'pause'
    }
    if (status.state === 'pause') {
      await sendMpdCommand('pause 0')
      return 'play'
    }
    // stop 态则播放首曲或当前位置
    await sendMpdCommand('play')
    return 'play'
  } catch (error) {
    console.error('[lpip-player:mpd] 切换播放状态失败:', error)
    return 'stop'
  }
}

/**
 * 切至下一曲
 */
export async function nextSong(): Promise<boolean> {
  try {
    await ensureQueuePopulated()
    await sendMpdCommand('next')
    return true
  } catch (error) {
    console.error('[lpip-player:mpd] 下一曲失败:', error)
    return false
  }
}

/**
 * 切至上一曲
 */
export async function prevSong(): Promise<boolean> {
  try {
    await ensureQueuePopulated()
    await sendMpdCommand('previous')
    return true
  } catch (error) {
    console.error('[lpip-player:mpd] 上一曲失败:', error)
    return false
  }
}

/**
 * 寻道跳转至指定时间秒数
 */
export async function seekSong(timeSeconds: number): Promise<boolean> {
  try {
    // MPD seekcur 接受浮点秒: 保留两位小数精确落点, 避免整秒截断导致实际位置退回上一句歌词
    const safeTime = Math.max(0, Math.round(timeSeconds * 100) / 100)
    await sendMpdCommand(`seekcur ${safeTime}`)
    return true
  } catch (error) {
    console.error('[lpip-player:mpd] 寻道失败:', error)
    return false
  }
}

/**
 * 将指定歌曲追加至 MPD 当前队列
 */
export async function addToQueue(file: string): Promise<boolean> {
  try {
    await sendMpdCommand(`add "${file}"`)
    return true
  } catch (error) {
    console.error(`[lpip-player:mpd] 添加到队列失败: ${file}`, error)
    return false
  }
}

/**
 * 获取 MPD 实时播放队列中的全部曲目列表
 */
export async function getQueue(): Promise<MpdSong[]> {
  try {
    const raw = await sendMpdCommand('playlistinfo')
    return parseMpdPlaylist(raw)
  } catch (error) {
    console.error('[lpip-player:mpd] 获取播放队列失败:', error)
    return []
  }
}

/**
 * 播放队列中指定曲目
 */
export async function playQueueItem(pos: number, queueId?: number): Promise<boolean> {
  try {
    if (typeof queueId === 'number' && !Number.isNaN(queueId)) {
      await sendMpdCommand(`playid ${queueId}`)
    } else {
      await sendMpdCommand(`play ${pos}`)
    }
    return true
  } catch (error) {
    console.error(`[lpip-player:mpd] 播放队列曲目失败 (pos: ${pos}, queueId: ${queueId}):`, error)
    return false
  }
}

/**
 * 从队列中移除指定曲目
 */
export async function removeQueueItem(pos: number, queueId?: number): Promise<boolean> {
  try {
    if (typeof queueId === 'number' && !Number.isNaN(queueId)) {
      await sendMpdCommand(`deleteid ${queueId}`)
    } else {
      await sendMpdCommand(`delete ${pos}`)
    }
    return true
  } catch (error) {
    console.error(`[lpip-player:mpd] 移除队列曲目失败 (pos: ${pos}, queueId: ${queueId}):`, error)
    return false
  }
}

/**
 * 清空当前播放队列
 */
export async function clearQueue(): Promise<boolean> {
  try {
    await sendMpdCommand('clear')
    return true
  } catch (error) {
    console.error('[lpip-player:mpd] 清空队列失败:', error)
    return false
  }
}

/**
 * 移动队列中的曲目顺序
 */
export async function moveQueueItem(fromPos: number, toPos: number): Promise<boolean> {
  try {
    await sendMpdCommand(`move ${fromPos} ${toPos}`)
    return true
  } catch (error) {
    console.error(`[lpip-player:mpd] 移动队列曲目失败 (${fromPos} -> ${toPos}):`, error)
    return false
  }
}

/**
 * 设置 MPD 音量 (0 ~ 100)
 */
export async function setVolume(volume: number): Promise<boolean> {
  try {
    const safeVol = Math.max(0, Math.min(100, Math.round(volume)))
    await sendMpdCommand(`setvol ${safeVol}`)
    return true
  } catch (error) {
    console.error('[lpip-player:mpd] 设置音量失败:', error)
    return false
  }
}

/**
 * 设置播放模式 ('sequence' | 'shuffle' | 'single')
 * - sequence (列表循环): repeat 1, random 0, single 0
 * - shuffle (随机播放): repeat 1, random 1, single 0
 * - single (单曲循环): repeat 1, random 0, single 1
 */
export async function setPlaybackMode(mode: PlaybackMode): Promise<boolean> {
  try {
    if (mode === 'single') {
      await sendMpdCommand('repeat 1\nrandom 0\nsingle 1')
    } else if (mode === 'shuffle') {
      await sendMpdCommand('repeat 1\nrandom 1\nsingle 0')
    } else {
      await sendMpdCommand('repeat 1\nrandom 0\nsingle 0')
    }
    return true
  } catch (error) {
    console.error('[lpip-player:mpd] 设置播放模式失败:', error)
    return false
  }
}

/**
 * 解析 LRC 纯文本歌词为带时间戳的结构化行
 */
export function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split('\n')
  const result: { time: number; text: string }[] = []
  const timeRegex = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const timestamps: number[] = []
    let match: RegExpExecArray | null
    timeRegex.lastIndex = 0

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const mins = Number.parseInt(match[1], 10)
      const secs = Number.parseFloat(match[2])
      timestamps.push(mins * 60 + secs)
    }

    const text = trimmed.replace(timeRegex, '').trim()
    if (timestamps.length > 0 && text) {
      for (const t of timestamps) {
        result.push({
          time: Math.round(t * 100) / 100,
          text
        })
      }
    }
  }

  result.sort((a, b) => a.time - b.time)

  return result.map((item, idx) => ({
    id: idx,
    primary: item.text,
    time: item.time
  }))
}

/**
 * 获取指定音频文件的歌词行数据 (优先读取 .lrc 文件，其次提取 FLAC/MP3 内嵌标签)
 */
export function getSongLyrics(relPath: string): LyricLine[] {
  if (cachedLyrics.has(relPath)) {
    return cachedLyrics.get(relPath)!
  }

  const musicDir = join(app.getPath('home'), 'Music')
  const audioPath = join(musicDir, relPath)

  if (!existsSync(audioPath)) {
    return []
  }

  let lrcRaw = ''

  // 1. 优先检查同名 .lrc 文件
  const lrcPath = audioPath.replace(/\.[^/.]+$/, '.lrc')
  if (existsSync(lrcPath)) {
    try {
      lrcRaw = readFileSync(lrcPath, 'utf-8')
    } catch {
      // 忽略读取错误
    }
  }

  // 2. 检查 FLAC 内嵌 LYRICS 标签
  if (!lrcRaw && audioPath.toLowerCase().endsWith('.flac')) {
    try {
      const tag = execSync(`metaflac --show-tag=LYRICS "${audioPath}" 2>/dev/null`).toString('utf-8')
      if (tag.startsWith('LYRICS=')) {
        lrcRaw = tag.slice(7)
      } else if (tag.trim()) {
        lrcRaw = tag.trim()
      }
    } catch {
      // 忽略 metaflac 异常
    }
  }

  // 3. 通用 ffprobe 提取 lyrics / unsyncedlyrics
  if (!lrcRaw) {
    try {
      const out = execSync(
        `ffprobe -v error -show_entries format_tags=LYRICS:format_tags=lyrics:format_tags=unsyncedlyrics -of default=noprint_wrappers=1:nokey=1 "${audioPath}" 2>/dev/null`
      ).toString('utf-8')
      if (out.trim()) {
        lrcRaw = out.trim()
      }
    } catch {
      // 忽略 ffprobe 异常
    }
  }

  if (lrcRaw) {
    const parsed = parseLrc(lrcRaw)
    cachedLyrics.set(relPath, parsed)
    return parsed
  }

  return []
}

/**
 * 获取封面图片的本地缓存目录
 */
function getCoverCacheDir(): string {
  const dir = join(app.getPath('home'), '.cache', 'lpip-player', 'covers')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 提取或从缓存读取歌曲的内嵌专辑封面
 */
export function getOrExtractAlbumCover(relPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const musicDir = join(app.getPath('home'), 'Music')
    const audioPath = join(musicDir, relPath)

    if (!existsSync(audioPath)) {
      resolve(null)
      return
    }

    const cacheDir = getCoverCacheDir()
    const hash = createHash('sha1').update(relPath).digest('hex')
    const coverPath = join(cacheDir, `${hash}.jpg`)
    const noCoverPath = join(cacheDir, `${hash}.nocover`)

    // 命中图片缓存
    if (existsSync(coverPath)) {
      resolve(coverPath)
      return
    }

    // 已经验证过无内嵌封面
    if (existsSync(noCoverPath)) {
      resolve(null)
      return
    }

    // 调用 ffmpeg 快速零拷贝剥离内嵌图片 (耗时仅数十毫秒)
    execFile(
      'ffmpeg',
      ['-y', '-i', audioPath, '-an', '-vcodec', 'copy', '-f', 'image2', coverPath],
      (err) => {
        if (err || !existsSync(coverPath)) {
          if (existsSync(coverPath)) {
            unlinkSync(coverPath)
          }
          try {
            writeFileSync(noCoverPath, '')
          } catch {
            // 忽略写入错误
          }
          resolve(null)
          return
        }

        try {
          const stat = statSync(coverPath)
          if (stat.size > 0) {
            resolve(coverPath)
          } else {
            unlinkSync(coverPath)
            writeFileSync(noCoverPath, '')
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      }
    )
  })
}
