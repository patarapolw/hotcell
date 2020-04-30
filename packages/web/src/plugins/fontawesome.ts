import Vue from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faSearch, faAngleLeft, faAngleRight
} from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(
  faSearch, faAngleLeft, faAngleRight,
  faGithub
)

Vue.component('fontawesome', FontAwesomeIcon)
