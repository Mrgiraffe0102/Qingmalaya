import { Component, PropsWithChildren } from 'react'
import './app.css'
import GlobalAudioPlayer from './components/GlobalAudioPlayer'

class App extends Component<PropsWithChildren> {
  componentDidMount() {}

  componentWillUnmount() {}

  // componentDidShow() {}
  // componentDidHide() {}

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
