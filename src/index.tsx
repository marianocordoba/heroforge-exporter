import { render } from 'solid-js/web'
import { Widget } from './widget'

if (!document.getElementById('heroforge-exporter')) {
  render(() => <Widget />, document.body)
}
