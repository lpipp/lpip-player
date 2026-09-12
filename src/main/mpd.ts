import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { join, resolve, sep } from 'node:path'
import { app } from 'electron'

import { loadConfig } from './config'
import type { AddToQueueResult, LyricLine, MpdPlaylist, MpdSong, MpdStatus, PlaybackMode, PlaySessionState, PlayStats, PlayStatsEntry } from '../types/music'

/**
 * 缓存的本地曲库数据，避免每次展开抽屉都重新全量查询
 */
let cachedSongs: MpdSong[] | null = null

/**
 * 缓存的歌词解析结果 (以 relPath 为 key)
 */
const cachedLyrics = new Map<string, LyricLine[]>()

/**
 * 转义 MPD 指令中的双引号与反斜杠，杜绝指令注入与路径语法解析错误
 */
export function escapeMpdString(str: string): string {
  return str.replace(/[\r\n\t\0]/g, '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

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

    const trimmedCmd = command.trim()
    const isCommandList = trimmedCmd.startsWith('command_list_begin')
    const expectedOkCount = isCommandList
      ? 1
      : trimmedCmd.split('\n').filter((l) => l.trim().length > 0).length

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8')
      const lines = buffer.split('\n')

      // MPD 协议规范: 错误以以 ACK 开头的行指示
      const ackLine = lines.find((l) => l.startsWith('ACK '))
      if (ackLine) {
        cleanup()
        reject(new Error(`[lpip-player:mpd] 指令执行失败: ${command.trim()} -> ${ackLine.trim()}`))
        return
      }

      // 统计已返回的独立 OK 终止行数 (排除 MPD 欢迎语 OK MPD ...)
      const okCount = lines.filter((l) => l.trim() === 'OK').length
      if (okCount >= expectedOkCount) {
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
      const lines = buffer.split('\n')
      const ackLine = lines.find((l) => l.startsWith('ACK '))
      if (ackLine) {
        reject(new Error(`[lpip-player:mpd] 指令执行失败: ${command.trim()} -> ${ackLine.trim()}`))
      } else {
        resolve(buffer)
      }
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
        coverUrl: `app-media://cover/${encodeURIComponent(file)}?tier=thumb`
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
    coverUrl: item.coverUrl || `app-media://cover/${encodeURIComponent(file)}?tier=thumb`,
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
        coverUrl: `app-media://cover/${encodeURIComponent(file)}?tier=thumb`
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
            // 音量 0 是合法的静音值（falsy），不可用 || 回退，否则静音会被误判为缺失而弹回 100
            const parsedVol = Number.parseInt(v, 10)
            result.volume = Number.isFinite(parsedVol) ? Math.max(0, Math.min(100, parsedVol)) : 100
          } else if (k === 'elapsed') {
            result.currentTime = Number.parseFloat(v) || 0
          } else if (k === 'duration') {
            result.duration = Number.parseFloat(v) || 0
          } else if (k === 'playlistlength') {
            result.playlistLength = Number.parseInt(v, 10) || 0
          } else if (k === 'playlist') {
            result.playlistVersion = Number.parseInt(v, 10) || 0
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

    result.connected = true
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
      mode: 'sequence',
      connected: false
    }
  }
}

/**
 * 播放指定音源文件 (若在队列中则跳播，否则加入后播放)
 */
export async function playSong(file: string): Promise<boolean> {
  try {
    const escaped = escapeMpdString(file)
    // 检查当前队列是否已包含此曲
    const findRes = await sendMpdCommand(`playlistfind "file" "${escaped}"`)
    const idMatch = findRes.match(/Id:\s*(\d+)/i)

    if (idMatch) {
      const songId = idMatch[1]
      await sendMpdCommand(`playid ${songId}`)
    } else {
      const addRes = await sendMpdCommand(`addid "${escaped}"`)
      const newIdMatch = addRes.match(/Id:\s*(\d+)/i)
      if (newIdMatch) {
        await sendMpdCommand(`playid ${newIdMatch[1]}`)
      } else {
        await sendMpdCommand('play')
      }
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
    if (status.playlistLength === 0) {
      return 'stop'
    }
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
    const status = await getStatus()
    if (status.playlistLength === 0) {
      return false
    }
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
    const status = await getStatus()
    if (status.playlistLength === 0) {
      return false
    }
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
    const status = await getStatus()
    if (status.state === 'stop' || status.playlistLength === 0) {
      return false
    }
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
 * 清理 MPD 队列中的重复歌曲（保证每个 file 路径仅保留首个实例）
 */
export async function deduplicateQueue(): Promise<void> {
  try {
    const raw = await sendMpdCommand('playlistinfo')
    const queue = parseMpdPlaylist(raw)
    const seen = new Set<string>()
    const duplicateIds: number[] = []

    for (const song of queue) {
      if (seen.has(song.file)) {
        if (typeof song.queueId === 'number' && !Number.isNaN(song.queueId)) {
          duplicateIds.push(song.queueId)
        }
      } else {
        seen.add(song.file)
      }
    }

    // 从后向前删除重复项，确保不破坏前面的索引
    for (let i = duplicateIds.length - 1; i >= 0; i--) {
      await sendMpdCommand(`deleteid ${duplicateIds[i]}`)
    }
  } catch (error) {
    console.error('[lpip-player:mpd] 队列去重检查失败:', error)
  }
}

/**
 * 将指定歌曲追加至 MPD 当前队列
 * 核心约束：播放队列不能有两首同样的歌。若已在队列中，直接返回 alreadyInQueue: true，绝不重复添加。
 */
export async function addToQueue(file: string): Promise<AddToQueueResult> {
  try {
    // 1. 检查当前队列是否已存在该歌曲 (以文件路径 file 为唯一判定)
    const queue = await getQueue()
    const alreadyExists = queue.some((song) => song.file === file)
    if (alreadyExists) {
      return { success: true, alreadyInQueue: true }
    }

    // 2. 不存在时真正向 MPD 发送 add 指令 (转义路径避免语法解析错误)
    await sendMpdCommand(`add "${escapeMpdString(file)}"`)
    return { success: true, alreadyInQueue: false }
  } catch (error) {
    console.error(`[lpip-player:mpd] 添加到队列失败: ${file}`, error)
    return { success: false, alreadyInQueue: false }
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
export async function removeQueueItem(pos: number, queueId?: number, file?: string): Promise<boolean> {
  try {
    // 场景 1: 传入了具体文件路径 (优先彻底清理队列中所有该文件的条目，并准确返回是否命中)
    if (file) {
      const queue = await getQueue()
      let found = false
      for (const item of queue) {
        if (item.file === file && typeof item.queueId === 'number' && !Number.isNaN(item.queueId)) {
          await sendMpdCommand(`deleteid ${item.queueId}`)
          found = true
        }
      }
      return found
    }

    // 场景 2: 按 queueId 删除指定单项 (如 QueueDrawer 中按队列 ID 移除)
    if (typeof queueId === 'number' && !Number.isNaN(queueId)) {
      await sendMpdCommand(`deleteid ${queueId}`)
      return true
    }

    // 场景 3: 按 pos 索引删除单项 (保底按队列槽位)
    if (typeof pos === 'number' && !Number.isNaN(pos) && pos >= 0) {
      await sendMpdCommand(`delete ${pos}`)
      return true
    }

    return false
  } catch (error) {
    console.error(`[lpip-player:mpd] 移除队列曲目失败 (pos: ${pos}, queueId: ${queueId}, file: ${file}):`, error)
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
  // 安全说明：audioPath 源自 MPD 上报的文件名，不可信；命令与参数分离走 argv 数组，
  // 不经过 shell（双引号挡不住 $() 与反引号，故禁用字符串拼接），stderr 直接丢弃。
  if (!lrcRaw && audioPath.toLowerCase().endsWith('.flac')) {
    try {
      // execFileSync 不起 shell，恶意文件名仅被当作普通参数，无注入风险
      const tag = execFileSync('metaflac', ['--show-tag=LYRICS', audioPath], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf-8')
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
  // 安全说明：同上，argv 数组直传、不走 shell，杜绝 MPD 上报文件名引发的命令注入。
  if (!lrcRaw) {
    try {
      const out = execFileSync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format_tags=LYRICS:format_tags=lyrics:format_tags=unsyncedlyrics', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
        { stdio: ['ignore', 'pipe', 'ignore'] }
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
 * 封面缩略图目标边长 (像素)。画册流/曲库网格统一走缩略图，原图档留给大舞台。
 */
const THUMB_SIZE = 512

/**
 * 从音频文件剥离内嵌封面的并发上限。仅限制「读 FLAC + spawn ffmpeg」这一昂贵步骤，
 * 避免视口内数十张未缓存封面同时提取造成主进程 CPU/IO 尖峰。缓存命中与原图补压缩略图不排队。
 */
const MAX_CONCURRENT_EXTRACT = 2

let activeExtractCount = 0
const pendingExtracts: Array<() => void> = []

/**
 * 手写 promise 并发队列 (零依赖)。并发达到上限时新任务排队，某个任务完成后依次唤醒下一个。
 */
function runExtract<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = async (): Promise<void> => {
      activeExtractCount++
      try {
        resolve(await task())
      } catch (err) {
        reject(err)
      } finally {
        activeExtractCount--
        const next = pendingExtracts.shift()
        if (next) next()
      }
    }

    if (activeExtractCount < MAX_CONCURRENT_EXTRACT) {
      void start()
    } else {
      pendingExtracts.push(() => void start())
    }
  })
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
 * 用 ffmpeg 零拷贝从音频文件剥离内嵌封面 (不转码，直接复制内嵌图片字节流)
 * @returns 是否成功产出非空封面文件
 */
function extractCoverFromAudio(audioPath: string, coverPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'ffmpeg',
      ['-y', '-i', audioPath, '-an', '-vcodec', 'copy', '-f', 'image2', coverPath],
      (err) => {
        if (err || !existsSync(coverPath)) {
          if (existsSync(coverPath)) {
            unlinkSync(coverPath)
          }
          resolve(false)
          return
        }

        try {
          if (statSync(coverPath).size > 0) {
            resolve(true)
          } else {
            unlinkSync(coverPath)
            resolve(false)
          }
        } catch {
          resolve(false)
        }
      }
    )
  })
}

/**
 * 从已提取的原图补生成 512px JPEG 缩略图 (重编码为真 JPEG，顺带归一化 png 等异常内嵌流)
 * @returns 是否成功产出非空缩略图文件
 */
function generateThumbFromCover(coverPath: string, thumbPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'ffmpeg',
      [
        '-y',
        '-i',
        coverPath,
        '-vf',
        `scale=${THUMB_SIZE}:${THUMB_SIZE}:force_original_aspect_ratio=decrease`,
        '-q:v',
        '4',
        thumbPath
      ],
      (err) => {
        if (err || !existsSync(thumbPath)) {
          if (existsSync(thumbPath)) {
            unlinkSync(thumbPath)
          }
          resolve(false)
          return
        }

        try {
          if (statSync(thumbPath).size > 0) {
            resolve(true)
          } else {
            unlinkSync(thumbPath)
            resolve(false)
          }
        } catch {
          resolve(false)
        }
      }
    )
  })
}

/**
 * 提取或从缓存读取歌曲的内嵌专辑封面 (双档缓存)
 *
 * - `tier = 'thumb'` (默认): 返回 512px JPEG 缩略图，供画册流/曲库/队列/艺人/歌单等网格展示
 * - `tier = 'full'`: 返回零拷贝剥离的内嵌原图，留给大舞台等高清场景
 *
 * 双档命名: `<hash>.jpg` = 原图, `<hash>.thumb.jpg` = 缩略图, `<hash>.nocover` = 无内嵌封面标记。
 * 缩略图缺失但原图已缓存时 (存量老缓存迁移)，直接从原图补压缩略图，不重读音频文件。
 * 仅「从音频文件提取原图」这一昂贵步骤进入并发队列，其余路径直接执行。
 */
export function getOrExtractAlbumCover(relPath: string, tier: 'thumb' | 'full' = 'thumb'): Promise<string | null> {
  const musicDir = join(app.getPath('home'), 'Music')
  const audioPath = join(musicDir, relPath)

  if (!existsSync(audioPath)) {
    return Promise.resolve(null)
  }

  const cacheDir = getCoverCacheDir()
  const hash = createHash('sha1').update(relPath).digest('hex')
  const coverPath = join(cacheDir, `${hash}.jpg`)
  const thumbPath = join(cacheDir, `${hash}.thumb.jpg`)
  const noCoverPath = join(cacheDir, `${hash}.nocover`)
  const wantThumb = tier === 'thumb'

  // 已经验证过无内嵌封面
  if (existsSync(noCoverPath)) {
    return Promise.resolve(null)
  }

  // 缩略图命中 (网格场景的主路径)
  if (wantThumb && existsSync(thumbPath)) {
    return Promise.resolve(thumbPath)
  }

  // 原图已缓存: full 直接命中; thumb 走存量老缓存迁移路径，从原图补压缩略图
  if (existsSync(coverPath)) {
    if (!wantThumb) {
      return Promise.resolve(coverPath)
    }
    return generateThumbFromCover(coverPath, thumbPath).then((ok) => (ok ? thumbPath : coverPath))
  }

  // 需要从音频文件提取原图 (昂贵步骤 → 并发队列)，成功后按需生成缩略图
  return runExtract(() => extractCoverFromAudio(audioPath, coverPath)).then(async (ok) => {
    if (!ok) {
      try {
        writeFileSync(noCoverPath, '')
      } catch {
        // 忽略写入错误
      }
      return null
    }

    if (wantThumb) {
      const thumbOk = await generateThumbFromCover(coverPath, thumbPath)
      return thumbOk ? thumbPath : coverPath
    }
    return coverPath
  })
}

/**
 * 获取 MPD 歌单文件存储根目录 (~/.config/mpd/playlists)
 */
export function getPlaylistsDir(): string {
  const dir = join(app.getPath('home'), '.config', 'mpd', 'playlists')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 当本地歌单目录首次初始化为空时，自动写入预置歌单供即时体验 (仅执行一次，避免复活用户已删除歌单)
 */
async function seedDefaultPlaylistsIfEmpty(): Promise<void> {
  try {
    const dir = getPlaylistsDir()
    const seedMarker = join(dir, '.seeded')
    if (existsSync(seedMarker)) {
      return
    }

    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.m3u')) : []
    if (files.length === 0) {
      const songs = await getLibrary()
      if (songs.length > 0) {
        const sampleSongs = songs.slice(0, 10).map((s) => s.file).join('\n') + '\n'
        writeFileSync(join(dir, '我的红心精选.m3u'), sampleSongs, 'utf-8')
      }
    }
    writeFileSync(seedMarker, '1\n', 'utf-8')
  } catch (err) {
    console.error('[lpip-player:mpd] 预置歌单初始化失败:', err)
  }
}

/**
 * 解析 MPD `listplaylists` 返回的纯文本
 */
export function parseMpdPlaylists(raw: string): { name: string; lastModified?: string }[] {
  const lines = raw.split('\n')
  const results: { name: string; lastModified?: string }[] = []
  let cur: { name: string; lastModified?: string } | null = null

  for (const line of lines) {
    if (line.startsWith('playlist: ')) {
      if (cur && cur.name) {
        results.push(cur)
      }
      cur = { name: line.slice(10).trim() }
    } else if (cur && line.startsWith('Last-Modified: ')) {
      cur.lastModified = line.slice(15).trim()
    }
  }
  if (cur && cur.name) {
    results.push(cur)
  }
  return results
}

/**
 * 校验并清洗歌单名称，杜绝控制字符、引号、路径穿越与扩展名冗余
 */
export function sanitizePlaylistName(name: string): string {
  return name
    .trim()
    .replace(/[\r\n\t\0]/g, '')
    .replace(/[/\\]/g, '-')
    .replace(/["']/g, '')
    .replace(/^[.]+/, '')
    .replace(/\.m3u$/i, '')
    .trim()
}

/**
 * 获取经过安全根目录沙箱判定的歌单物理路径 (.m3u)
 */
export function getSafePlaylistFilePath(name: string): string | null {
  const clean = sanitizePlaylistName(name)
  if (!clean) return null
  const dir = getPlaylistsDir()
  const filePath = join(dir, `${clean}.m3u`)
  // 严防任何跳出 playlists 目录的越权路径穿越
  const resolved = resolve(filePath)
  if (!resolved.startsWith(resolve(dir) + sep)) {
    return null
  }
  return filePath
}

/**
 * 获取所有歌单信息概览 (含曲目数量、总时长与封面首曲)
 */
export async function getPlaylists(): Promise<MpdPlaylist[]> {
  await seedDefaultPlaylistsIfEmpty()

  try {
    let list: { name: string; lastModified?: string }[] = []
    try {
      const raw = await sendMpdCommand('listplaylists')
      list = parseMpdPlaylists(raw)
    } catch (mpdErr) {
      console.warn('[lpip-player:mpd] MPD listplaylists 指令失败，尝试从本地目录读取:', mpdErr)
      const dir = getPlaylistsDir()
      if (existsSync(dir)) {
        const files = readdirSync(dir).filter((f) => f.endsWith('.m3u'))
        list = files.map((f) => ({
          name: f.replace(/\.m3u$/i, ''),
          lastModified: new Date(statSync(join(dir, f)).mtimeMs).toISOString()
        }))
      }
    }

    const playlists = await Promise.all(
      list.map(async (item) => {
        try {
          const songs = await getPlaylistSongs(item.name)
          const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0)
          const coverSong = songs.find((s) => s.file) || songs[0]

          return {
            name: item.name,
            lastModified: item.lastModified,
            songCount: songs.length,
            totalDuration,
            coverSong,
            coverUrl: coverSong ? coverSong.coverUrl : undefined
          }
        } catch {
          return {
            name: item.name,
            lastModified: item.lastModified,
            songCount: 0,
            totalDuration: 0
          }
        }
      })
    )

    return playlists
  } catch (err) {
    console.error('[lpip-player:mpd] 获取歌单列表失败:', err)
    return []
  }
}

/**
 * 获取指定歌单的所有歌曲
 */
export async function getPlaylistSongs(name: string): Promise<MpdSong[]> {
  const cleanName = sanitizePlaylistName(name)
  if (!cleanName) return []

  try {
    try {
      const infoRaw = await sendMpdCommand(`listplaylistinfo "${escapeMpdString(cleanName)}"`)
      const songs = parseMpdLibrary(infoRaw)
      if (songs.length > 0) {
        return songs.map((s, idx) => ({
          ...s,
          // 注意：此处严禁设置 pos 属性，否则在 App.tsx 中点击播放时会被当作实时播放队列索引处理
          id: `pl_${cleanName}_${idx}_${s.file}`
        }))
      }
    } catch {
      // 若 MPD listplaylistinfo 异常，尝试从本地 .m3u 文件恢复
    }

    const filePath = getSafePlaylistFilePath(cleanName)
    if (filePath && existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'))
      const library = await getLibrary()
      const libMap = new Map<string, MpdSong>()
      for (const s of library) {
        libMap.set(s.file, s)
      }
      return lines.map((file, idx) => {
        const found = libMap.get(file)
        if (found) {
          return {
            ...found,
            id: `pl_${cleanName}_${idx}_${file}`
          }
        }
        return {
          id: `pl_${cleanName}_${idx}_${file}`,
          file,
          title: file.split('/').pop()?.replace(/\.[^/.]+$/, '') || file,
          artist: '未知艺人',
          album: '未知专辑',
          duration: 0,
          format: '',
          quality: 'STD',
          coverUrl: `app-media://cover/${encodeURIComponent(file)}?tier=thumb`
        } as MpdSong
      })
    }

    return []
  } catch (err) {
    console.error(`[lpip-player:mpd] 获取歌单歌曲失败: ${cleanName}`, err)
    return []
  }
}

/**
 * 创建新歌单
 */
export async function createPlaylist(name: string): Promise<boolean> {
  const cleanName = sanitizePlaylistName(name)
  if (!cleanName) return false

  const filePath = getSafePlaylistFilePath(cleanName)
  if (!filePath) return false

  if (existsSync(filePath)) {
    return false
  }

  try {
    writeFileSync(filePath, '', 'utf-8')
    return true
  } catch (err) {
    console.error(`[lpip-player:mpd] 创建歌单失败: ${cleanName}`, err)
    return false
  }
}

/**
 * 删除歌单
 */
export async function deletePlaylist(name: string): Promise<boolean> {
  const cleanName = sanitizePlaylistName(name)
  if (!cleanName) return false

  const filePath = getSafePlaylistFilePath(cleanName)
  if (!filePath) return false

  const existedOnDisk = existsSync(filePath)
  let mpdDeleted = false

  try {
    try {
      await sendMpdCommand(`rm "${escapeMpdString(cleanName)}"`)
      mpdDeleted = true
    } catch {
      // 忽略 MPD rm 异常
    }
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
    return mpdDeleted || existedOnDisk
  } catch (err) {
    console.error(`[lpip-player:mpd] 删除歌单失败: ${cleanName}`, err)
    return false
  }
}

/**
 * 重命名歌单
 */
export async function renamePlaylist(oldName: string, newName: string): Promise<boolean> {
  const cleanOld = sanitizePlaylistName(oldName)
  const cleanNew = sanitizePlaylistName(newName)
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return false

  const oldPath = getSafePlaylistFilePath(cleanOld)
  const newPath = getSafePlaylistFilePath(cleanNew)
  if (!oldPath || !newPath) return false

  if (existsSync(newPath)) {
    console.warn(`[lpip-player:mpd] 目标歌单名称已存在，禁止重名覆盖: ${cleanNew}`)
    return false
  }

  let renamed = false
  try {
    try {
      await sendMpdCommand(`rename "${escapeMpdString(cleanOld)}" "${escapeMpdString(cleanNew)}"`)
      renamed = true
    } catch {
      if (existsSync(oldPath)) {
        renameSync(oldPath, newPath)
        renamed = true
      }
    }
    return renamed
  } catch (err) {
    console.error(`[lpip-player:mpd] 重命名歌单失败 (${cleanOld} -> ${cleanNew}):`, err)
    return false
  }
}

/**
 * 向歌单追加单曲 (防重复追加)
 */
export async function addToPlaylist(name: string, file: string): Promise<boolean> {
  const cleanName = sanitizePlaylistName(name)
  if (!cleanName || !file) return false

  try {
    const songs = await getPlaylistSongs(cleanName)
    if (songs.some((s) => s.file === file)) {
      return true
    }

    try {
      await sendMpdCommand(`playlistadd "${escapeMpdString(cleanName)}" "${escapeMpdString(file)}"`)
      return true
    } catch {
      // MPD 指令失败时回退写入本地 .m3u 存储
      const filePath = getSafePlaylistFilePath(cleanName)
      if (filePath) {
        const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''
        const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''
        writeFileSync(filePath, `${existing}${prefix}${file}\n`, 'utf-8')
        return true
      }
      return false
    }
  } catch (err) {
    console.error(`[lpip-player:mpd] 向歌单添加单曲失败 (${cleanName}, ${file}):`, err)
    return false
  }
}

/**
 * 从歌单中移除指定位置的单曲
 */
export async function removeFromPlaylist(name: string, pos: number): Promise<boolean> {
  const cleanName = sanitizePlaylistName(name)
  if (!cleanName || pos < 0) return false

  try {
    try {
      await sendMpdCommand(`playlistdelete "${escapeMpdString(cleanName)}" ${pos}`)
      return true
    } catch {
      const filePath = getSafePlaylistFilePath(cleanName)
      if (filePath && existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').filter((l) => l.trim().length > 0 && !l.startsWith('#'))
        if (pos >= 0 && pos < lines.length) {
          lines.splice(pos, 1)
          writeFileSync(filePath, lines.length > 0 ? lines.join('\n') + '\n' : '', 'utf-8')
          return true
        }
      }
      return false
    }
  } catch (err) {
    console.error(`[lpip-player:mpd] 从歌单移出单曲失败 (${cleanName}, pos: ${pos}):`, err)
    return false
  }
}

/**
 * 播放整张歌单 (清空当前队列、载入歌单并从第 1 首开始播放)
 */
export async function playPlaylist(name: string): Promise<boolean> {
  const cleanName = sanitizePlaylistName(name)
  if (!cleanName) return false

  try {
    const songs = await getPlaylistSongs(cleanName)
    if (songs.length === 0) {
      return false
    }
    await sendMpdCommand(`clear\nload "${escapeMpdString(cleanName)}"\nplay 0`)
    return true
  } catch (err) {
    console.error(`[lpip-player:mpd] 播放歌单失败: ${cleanName}`, err)
    return false
  }
}

/**
 * 将整张歌单中的未入队单曲批量追加至当前实时播放队列 (去重、MPD command_list 极速推入)
 */
export async function enqueuePlaylist(name: string): Promise<boolean> {
  const cleanName = sanitizePlaylistName(name)
  if (!cleanName) return false

  try {
    const [playlistSongs, currentQueue] = await Promise.all([
      getPlaylistSongs(cleanName),
      getQueue()
    ])
    if (playlistSongs.length === 0) return false

    const queuedFiles = new Set(currentQueue.map((s) => s.file))
    const toAdd = playlistSongs.filter((s) => !queuedFiles.has(s.file))
    if (toAdd.length === 0) return true

    const commands = toAdd.map((s) => `add "${escapeMpdString(s.file)}"`)
    await sendMpdCommand(`command_list_begin\n${commands.join('\n')}\ncommand_list_end`)
    return true
  } catch (err) {
    console.error(`[lpip-player:mpd] 批量将歌单加入队列失败: ${cleanName}`, err)
    return false
  }
}

/* ============================================================
   统计信息抽屉 (MPD stickers playCount + stats.playtime)
   ============================================================ */

/** MPD sticker 键名: 单曲累计播放次数 */
export const PLAY_COUNT_STICKER_NAME = 'playCount'

/** 播放次数计数阈值下限: 30 秒 (短曲托底, 函数纯化可单测) */
export const PLAY_COUNT_MIN_MS = 30000

/** 播放次数计数阈值比例: 时长 × 50% */
export const PLAY_COUNT_HALF_RATIO = 0.5

/**
 * 计算一首歌的计数阈值 (毫秒): max(30s, duration × 50%)。时长未知或非法时回退 30s 下限
 */
export function calcPlayCountThresholdMs(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return PLAY_COUNT_MIN_MS
  }
  return Math.max(PLAY_COUNT_MIN_MS, durationSec * 1000 * PLAY_COUNT_HALF_RATIO)
}

/**
 * 解析 MPD `stats` 输出中的累计播放时长 playtime (秒, 容错回退 0)
 */
export function parseMpdPlaytime(raw: string): number {
  const match = raw.match(/^playtime:\s*(\d+)/im)
  const sec = match ? Number.parseInt(match[1], 10) : 0
  return Number.isFinite(sec) && sec >= 0 ? sec : 0
}

/**
 * 解析 MPD `sticker find song "" playCount` 输出为 file → playCount 映射
 * - 仅收录 playCount >= 1 的条目 (从高到低排序由调用方完成)
 * - 同一 file 重复出现取最后一次; 非法计数 (非数字/负数) 跳过
 */
export function parseStickerPlayCounts(raw: string): Map<string, number> {
  const counts = new Map<string, number>()
  const lines = raw.split('\n')
  let currentFile: string | null = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('file: ')) {
      currentFile = trimmed.slice(6).trim() || null
    } else if (currentFile && trimmed.startsWith('sticker: ')) {
      const kv = trimmed.slice(9).trim()
      const eq = kv.indexOf('=')
      if (eq !== -1 && kv.slice(0, eq).trim() === PLAY_COUNT_STICKER_NAME) {
        const n = Number.parseInt(kv.slice(eq + 1).trim(), 10)
        if (Number.isFinite(n) && n >= 1) {
          counts.set(currentFile, n)
        } else {
          counts.delete(currentFile)
        }
        currentFile = null
      }
    } else if (trimmed === 'OK' || trimmed.startsWith('ACK ')) {
      currentFile = null
    }
  }
  return counts
}

/**
 * 读取一首歌的累计播放次数 (无 sticker 时回退 0; 任一异常回退 0)
 */
export async function getPlayCount(file: string): Promise<number> {
  if (!file) return 0
  try {
    const raw = await sendMpdCommand(`sticker get song "${escapeMpdString(file)}" ${PLAY_COUNT_STICKER_NAME}`)
    const match = raw.match(new RegExp(`${PLAY_COUNT_STICKER_NAME}=(\\d+)`))
    const n = match ? Number.parseInt(match[1], 10) : 0
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    // 无 sticker (ACK no such sticker) 或连接异常均回退 0
    return 0
  }
}

/**
 * 一首歌的播放次数 +1 (read-modify-write: sticker get 后 set; 失败仅记 console 不抛)
 */
export async function incrementPlayCount(file: string): Promise<void> {
  if (!file) return
  try {
    const current = await getPlayCount(file)
    await sendMpdCommand(`sticker set song "${escapeMpdString(file)}" ${PLAY_COUNT_STICKER_NAME} ${current + 1}`)
  } catch (err) {
    console.error(`[lpip-player:mpd] 播放次数累加失败: ${file}`, err)
  }
}

/**
 * 获取统计信息抽屉全量数据: stats.playtime + sticker 排行 (降序) + 曲库元数据映射
 */
export async function getPlayStats(): Promise<PlayStats> {
  const empty: PlayStats = { totalPlayTimeSec: 0, totalPlayCount: 0, trackedSongCount: 0, entries: [] }
  try {
    const [statsRaw, stickerRaw, library] = await Promise.all([
      sendMpdCommand('stats'),
      sendMpdCommand(`sticker find song "" ${PLAY_COUNT_STICKER_NAME}`),
      getLibrary()
    ])

    const totalPlayTimeSec = parseMpdPlaytime(statsRaw)
    const counts = parseStickerPlayCounts(stickerRaw)
    if (counts.size === 0) {
      return { ...empty, totalPlayTimeSec }
    }

    let totalPlayCount = 0
    const entries: PlayStatsEntry[] = []
    for (const [file, playCount] of counts) {
      totalPlayCount += playCount
      const song = library.find((s) => s.file === file)
      if (song) {
        entries.push({
          file,
          title: song.title,
          artist: song.artist,
          coverUrl: song.coverUrl,
          duration: song.duration,
          playCount
        })
      } else {
        // sticker 残留但曲库已无此文件: 文件名回退标题, 不丢计数
        const baseName = (file.split('/').pop() || file).replace(/\.[^/.]+$/, '')
        entries.push({
          file,
          title: baseName || file,
          artist: '未知歌手',
          coverUrl: `app-media://cover/${encodeURIComponent(file)}?tier=thumb`,
          duration: 0,
          playCount
        })
      }
    }
    entries.sort((a, b) => b.playCount - a.playCount)
    return { totalPlayTimeSec, totalPlayCount, trackedSongCount: entries.length, entries }
  } catch (err) {
    console.error('[lpip-player:mpd] 获取播放统计失败:', err)
    return empty
  }
}

/**
 * 观察播放会话并在跨越阈值时触发 playCount +1 (供 broadcastStatus 每轮调用)
 *
 * 语义: file 变更开启新会话; 暂停冻结累计; seek 不清零; stop 清空会话;
 *        达到 max(30s, 时长×50%) 且未计过则 incrementPlayCount 一次。
 * nowMs 由调用方传入 (生产取 Date.now, 单测可注入虚拟时间)。
 *
 * @returns 更新后的会话状态 (null 表示无活跃会话)
 */
export function observePlaySession(
  prev: PlaySessionState | null,
  status: Pick<MpdStatus, 'state' | 'currentSong'>,
  nowMs: number,
  onCount: (file: string) => void
): PlaySessionState | null {
  const song = status.currentSong
  if (status.state !== 'play' || !song || !song.file) {
    // 暂停冻结: 保留 file 与 accumulatedMs, 仅冻结时间推进; 停止清空会话
    if (!prev) return null
    if (status.state === 'stop') return null
    return { ...prev, lastTickMs: null }
  }

  const file = song.file
  const durationSec = typeof song.duration === 'number' ? song.duration : 0
  if (!prev || prev.file !== file) {
    // 新歌开始: 若上一首没来得及达标则直接丢弃 (不计数), 开启新会话
    return { file, accumulatedMs: 0, counted: false, lastTickMs: nowMs }
  }

  const lastTick = prev.lastTickMs ?? nowMs
  const delta = Math.max(0, nowMs - lastTick)
  const accumulatedMs = prev.accumulatedMs + delta
  if (!prev.counted && accumulatedMs >= calcPlayCountThresholdMs(durationSec)) {
    onCount(file)
    return { file, accumulatedMs, counted: true, lastTickMs: nowMs }
  }
  return { file, accumulatedMs, counted: prev.counted, lastTickMs: nowMs }
}


