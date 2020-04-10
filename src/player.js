class Dispatcher {
  constructor () {
    this.handlers = []
  }

  listen (handler) {
    this.handlers.push(handler)
  }

  emit (...args) {
    this.handlers.forEach(handler => {
      handler(...args)
    })
  }
}

class Player {
  constructor () {
    this.audioContext = new AudioContext()
    this.playList = []
    this.playIndex = 0

    this.emptyNode = {
      file: null,
      offset: 0,
      start: null,
      source: null,
      buffer: null
    }

    this.onPlay = new Dispatcher()
    this.onPause = new Dispatcher()
    this.onChange = new Dispatcher()
    this.onReady = new Dispatcher()
  }
  // 将音频文件加入缓存?不会判断有没有加载过,点多少次就加载多少次到列表
  // 为什么特意返回个promise,本来async就是返回promise的啊
  async readAudioBuffer (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async evt => {
        this.audioContext
          .decodeAudioData(evt.target.result)
          .then(resolve, reject)
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  async append (file) {
    const isEmpty = this.isEmpty
    this.playList.push({
      file,
      offset: 0,
      start: null,
      source: null,
      buffer: await this.readAudioBuffer(file)
    })
    // 当前是空的,没有加载任何内容的化
    if (isEmpty) {
      this.onReady.emit(this)
    }
  }

  play () {
    if (!this.playList.length || this.current.source) {
      return
    }
    // 歌曲播放,之前只是存到内存中
    const source = this.audioContext.createBufferSource()
    source.buffer = this.current.buffer
    // 回调函数,下一首这个函数传给onended,这个是结束时用到的
    source.onended = this.next.bind(this)
    source.connect(this.audioContext.destination)
    source.start(0, this.current.offset)
    this.current.source = source
    this.current.start = this.audioContext.currentTime

    this.onPlay.emit(this)
  }

  pause () {
    if (!this.playList.length || !this.current.source) {
      return
    }
    // 歌曲停止,怎么有点像网络连接或数据库连接
    this.current.source.stop(0)
    this.current.source.disconnect(0)
    this.current.source.onended = null
    this.current.source = null
    this.current.offset = this.position
    this.current.start = null

    this.onPause.emit(this)
  }

  stop () {
    // 清空进度条
    this.pause()
    this.current.offset = 0
    this.current.start = null
  }

  next () {
    this.stop()
    this.playIndex++
    if (this.playIndex >= this.playList.length) {
      this.playIndex = 0
    }
    this.play()
    this.onChange.emit(this)
  }

  prev () {
    this.stop()
    this.playIndex--
    if (this.playIndex < 0) {
      // 防止length为0情况
      this.playIndex = Math.max(this.playList.length - 1, 0)
    }
    this.play()
    this.onChange.emit(this)
  }

  get isEmpty () {
    return this.current === this.emptyNode
  }

  get current () {
    return this.playList[this.playIndex] || this.emptyNode
  }

  get position () {
    if (!this.playList.length) {
      return 0
    }
    return (
      this.current.offset +
      (this.current.start !== null
        ? this.audioContext.currentTime - this.current.start
        : 0)
    )
  }

  // 似乎没有用到
  set position (val) {
    if (!this.playList.length) {
      return
    }
    this.stop()
    this.current.offset = val
    this.current.start = null
    this.play()
  }

  get duration () {
    return this.current.buffer ? this.current.buffer.duration : 0.001
  }
}

export const player = new Player()
