import Vue from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faSearch, faAngleLeft, faAngleRight, faExclamationCircle, faCheck, faTimes, faQuestion, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(
  faSearch, faAngleLeft, faAngleRight, faExclamationCircle, faCheck, faTimes, faQuestion, faExclamationTriangle,
  faGithub
)

Vue.component('fontawesome', FontAwesomeIcon)
