import { Component, PropsWithChildren } from 'react'
import './app.css'

class App extends Component<PropsWithChildren> {
  componentDidMount() {}

  componentWillUnmount() {}

  // componentDidShow() {}
  // componentDidHide() {}

  render() {
    return this.props.children
  }
}

export default App
