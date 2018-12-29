/**
 * @description generate id for every DraggableEl instance
 * @returns {Function}
 */
const generateDraggableElId = (function () {
  let id = 0
  return function () {
    return id++
  }
})()

const draggableElInstances = []

/**
 * @classdesc make elements draggable in a rect
 * @class DraggableEl
 */
class DraggableEl {
  /**
   * @description initialize instance, integrate options with default options
   * @param {Object} options
   * @param {Element} options.dragButton
   * @param {Element} [options.dragEl=dragButton]
   * @param {Element} [options.mouseMoveTarget=document]
   * @param {Element} [options.mouseUpTarget=document]
   * @param {Element} [options.mouseLeaveTarget=document]  mouseLeaveTarget===mouseUpTarget is a better choice
   * @param {Function} [options.mouseDownCb=function(event) {}]
   * @param {Function} [options.mouseMoveCb=function(event) {}]
   * @param {Function} [options.mouseUpCb=function(event) {}]
   * @param {Function} [options.mouseLeaveCb=function(event) {}]
   * @param {Element|Rect} [options.containerRect=options.dragEl.parentNode] dragEl will always stay in this area
   * @param {Boolean} [options.isLeftTop=false] use absolute position or translate
   * @param {Boolean} [options.isMouseLeaveOn=false] whether to listen mouseleave event
   */
  constructor ({
    dragButton,
    dragEl = dragButton,
    mouseMoveTarget = document,
    mouseUpTarget = document,
    mouseLeaveTarget = document,
    mouseDownCb = function () {},
    mouseMoveCb = function () {},
    mouseUpCb = function () {},
    mouseLeaveCb = function () {},
    containerRect = dragEl.parentNode,
    isLeftTop = false,
    isMouseLeaveOn = false
  }) {
    Object.assign(this, {
      dragButton,
      dragEl,
      mouseMoveTarget,
      mouseUpTarget,
      mouseLeaveTarget,
      containerRect,
      isLeftTop,
      isMouseLeaveOn
    })
    this.callback = {
      mouseDownCb,
      mouseMoveCb,
      mouseUpCb,
      mouseLeaveCb
    }
    this.mouseDownCbBind = this.mouseDownCb.bind(this)
    this.mouseMoveCbBind = this.mouseMoveCb.bind(this)
    this.mouseUpCbBind = this.mouseUpCb.bind(this)
    this.dragButton.addEventListener('mousedown', this.mouseDownCbBind)
    this.warnIllegalMouseLeave()
    this.id = generateDraggableElId()
    draggableElInstances.push(this)
  }

  /**
   * @description mousedown logic, mainly add event listener and other stuff such as record the start point
   * @param {Event} event
   */
  mouseDownCb (event) {
    // ensure the click is triggered by left click
    if (event.button !== 0) {
      return
    }
    this.hasRendered = true
    this.prevMouseMoveEvent = event
    this.mouseMoveTarget.addEventListener('mousemove', this.mouseMoveCbBind)
    this.mouseUpTarget.addEventListener('mouseup', this.mouseUpCbBind)
    if (this.isMouseLeaveOn) {
      this.mouseLeaveTarget.addEventListener('mouseleave', this.mouseUpCbBind)
    }
    this.callback.mouseDownCb(event)
  }
  // mousemove logic, such as record the current point
  mouseMoveCb (event) {
    // avoid unnecessary calculation
    if (this.hasRendered === false) {
      return
    }
    requestAnimationFrame(() => {
      this.mouseMoveCalc(event)
      this.hasRendered = true
      this.callback.mouseMoveCb(event)
    })
    this.hasRendered = false
  }
  // do mousemove calculation job
  mouseMoveCalc (event) {
    let offset = {
      x: event.clientX - this.prevMouseMoveEvent.clientX,
      y: event.clientY - this.prevMouseMoveEvent.clientY
    }
    let targetOffset = this.correctOffsetInContainer(offset)
    this.setCurPos(targetOffset)
    // save the previous event to calculate position next time
    this.prevMouseMoveEvent = event
  }
  /**
   * @description correct theoretical offset by containerRect
   * @param {Object} offset
   * @param {Number} offset.x current event.clientX - previous event.clientX
   * @param {Number} offset.y current event.clientY - previous event.clientY
   */
  correctOffsetInContainer (offset) {
    let curRect = this.dragEl.getBoundingClientRect()
    let containerRect =
      typeof this.containerRect.getBoundingClientRect === 'function'
        ? this.containerRect.getBoundingClientRect()
        : this.containerRect
    let isLeftOverflow = curRect.left + offset.x < containerRect.left
    let isRightOverflow = curRect.right + offset.x > containerRect.right
    let isTopOverflow = curRect.top + offset.y < containerRect.top
    let isBottomOverflow = curRect.bottom + offset.y > containerRect.bottom
    if (isLeftOverflow) {
      offset.x = containerRect.left - curRect.left
    } else if (isRightOverflow) {
      offset.x = containerRect.right - curRect.right
    }
    if (isTopOverflow) {
      offset.y = containerRect.top - curRect.top
    } else if (isBottomOverflow) {
      offset.y = containerRect.bottom - curRect.bottom
    }
    return offset
  }
  /**
   * @description get dragEl current position and offset, then set target position by current position + offset
   * @param {Object} offset
   * @param {Number} offset.x offset to current position in x axis
   * @param {Number} offset.y offset to current position in y axis
   */
  setCurPos (offset) {
    let style = window.getComputedStyle(this.dragEl)
    let targetPos
    if (this.isLeftTop === true) {
      targetPos = this.setCurLeftTop(style, offset)
    } else {
      targetPos = this.setCurTransform(style, offset)
    }
    this.dragEl.setAttribute('data-x', targetPos.x)
    this.dragEl.setAttribute('data-y', targetPos.y)
  }
  /**
   * @description set dragEl position by left,top
   * @param {CSSStyleDeclaration} style
   * @param {Object} offset
   * @returns {Object}
   */
  setCurLeftTop (style, offset) {
    let left = style.getPropertyValue('left')
    let top = style.getPropertyValue('top')
    left = Number.parseFloat(left) + Number(offset.x)
    top = Number.parseFloat(top) + Number(offset.y)
    this.dragEl.style.left = left + 'px'
    this.dragEl.style.top = top + 'px'
    return { x: left, y: top }
  }
  /**
   * @description set dragEl position by transform:translate()
   * @param {CSSStyleDeclaration} style
   * @param {Object} offset
   * @todo avoid overwriting scale and skew
   * @returns {Object}
   */
  setCurTransform (style, offset) {
    let matrix = style.getPropertyValue('transform').match(/\d+/g)
    let [translateX, translateY] = matrix ? matrix.slice(-2) : [0, 0]
    translateX = Number(translateX) + Number(offset.x)
    translateY = Number(translateY) + Number(offset.y)
    this.dragEl.style.transform = `translate(${translateX}px,${translateY}px)`
    return { x: translateX, y: translateY }
  }
  /**
   * @description mouseup logic, remove listeners and other stuff such as record the end point
   * @param {Event} event
   */
  mouseUpCb (event) {
    this.mouseMoveTarget.removeEventListener('mousemove', this.mouseMoveCbBind)
    this.mouseUpTarget.removeEventListener('mouseup', this.mouseUpCbBind)
    if (this.isMouseLeaveOn) {
      this.mouseLeaveTarget.removeEventListener(
        'mouseleave',
        this.mouseUpCbBind
      )
    }
    this.callback.mouseUpCb(event)
  }
  /**
   * @description remove mousedown listener
   * @returns {Boolean} if destroy successfully return true. Otherwise return false
   */
  destroy () {
    this.dragButton.removeEventListener('mousedown', this.mouseDownCbBind)
    let instanceIndex = draggableElInstances.findIndex(
      obj => obj.id === this.id
    )
    if (instanceIndex >= 0) {
      return !!draggableElInstances.splice(index, 1)
    }
    return false
  }
  /**
   * @description destroy all instances
   */
  destroyAll () {
    while (draggableElInstances.length !== 0) {
      let instance = draggableElInstances[0]
      instance.dragButton.removeEventListener(
        'mousedown',
        instance.mouseDownCbBind
      )
    }
  }
  /**
   * @description if [window,document,html].includes(mouseUpTarget)===false
   * @description if [window,document,html].includes(mouseUpTarget)===false
   */
  warnIllegalMouseLeave () {
    let needMouseLeaveMsg =
      'You had better turn on isMouseLeaveOn and mouseLeaveTarget because your mouseUpTarget is not in [window, document, document.documentElement]. In this case, mouseup event won\'t be caught when user release the right button out of document or window. In this case, mouseleave would catch it.'
    let noNeedMouseLeave =
      'You don\'t have to listen mouseleave event because your mouseUpTarget is in [window, document, document.documentElement]. In this case, mouseup event would be caught even you release your right button out of document or window.'
    let idealMouseUpTarget = [window, document, document.documentElement]
    let isMouseUpTargetIdeal =
      idealMouseUpTarget.includes(this.mouseUpTarget) === true
    if (isMouseUpTargetIdeal && this.isMouseLeaveOn === true) {
      console.warn(noNeedMouseLeave)
    }
    if (!isMouseUpTargetIdeal && this.isMouseLeaveOn === false) {
      console.warn(needMouseLeaveMsg)
    }
  }
}

DraggableEl.instances = []
// draggableEl config
let appRect = app.getBoundingClientRect()
new DraggableEl({
  dragButton: app__drag_el,
  dragEl: app__drag_box,
  mouseMoveTarget: document,
  mouseUpTarget: document.body,
  mouseLeaveTarget: document.body,
  containerRect: {
    left: appRect.left - 100,
    right: appRect.right + 100,
    top: appRect.top - 100,
    bottom: appRect.bottom + 100
  },
  isLeftTop: true,
  isMouseLeaveOn: true
})

// export default DraggableEl