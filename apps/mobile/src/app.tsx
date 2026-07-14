import { Component, PropsWithChildren } from 'react'
import './app.css'
import GlobalAudioPlayer from './components/GlobalAudioPlayer'
import { useAuthStore, isAuthenticated } from './store/auth'
import { checkUpdateOnWebOpen } from './utils/version-check'
import { startNotificationPolling } from './utils/system-notification'

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    // H5: check for app updates on first open.
    if (process.env.TARO_ENV === 'h5') {
      void checkUpdateOnWebOpen()
    }

    // Start system notification polling (if authenticated).
    // We check auth state on next tick so Zustand persist has time to hydrate.
    // The polling auto-pauses/resumes via Taro.onAppHide/onAppShow handlers
    // registered inside startNotificationPolling.
    setTimeout(() => {
      const state = useAuthStore.getState()
      if (isAuthenticated(state)) {
        startNotificationPolling()
      }
    }, 2000)
  }

  componentWillUnmount() {}

  render() {
    return (
      <>
        <GlobalAudioPlayer />
        {this.props.children}
      </>
    )
  }
}

export default App
