import RecordingH5 from './RecordingH5'
import RecordingWeapp from './RecordingWeapp'

export default process.env.TARO_ENV === 'weapp' ? RecordingWeapp : RecordingH5
