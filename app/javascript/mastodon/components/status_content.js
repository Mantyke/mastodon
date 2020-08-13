import React from 'react';
import ImmutablePropTypes from 'react-immutable-proptypes';
import PropTypes from 'prop-types';
import { isRtl } from '../rtl';
import { FormattedMessage } from 'react-intl';
import Permalink from './permalink';
import classnames from 'classnames';
import PollContainer from 'mastodon/containers/poll_container';
import Icon from 'mastodon/components/icon';
import { autoPlayGif } from 'mastodon/initial_state';
import { getLocale  } from 'mastodon/locales';
import axios from 'axios';
import { parse as htmlPare } from 'node-html-parser';
import googleLogo from 'images/google_logo.svg';

const MAX_HEIGHT = 642; // 20px * 32 (+ 2px padding at the top)

export default class StatusContent extends React.PureComponent {

  static contextTypes = {
    router: PropTypes.object,
  };

  static propTypes = {
    status: ImmutablePropTypes.map.isRequired,
    expanded: PropTypes.bool,
    showThread: PropTypes.bool,
    onExpandedToggle: PropTypes.func,
    onClick: PropTypes.func,
    collapsable: PropTypes.bool,
    onCollapsedToggle: PropTypes.func,
  };

  state = {
    hidden: true,
    hideTranslation: true,
    translation: null,
    translationStatus: null,
  };

  _updateStatusLinks () {
    const node = this.node;

    if (!node) {
      return;
    }

    const links = node.querySelectorAll('a');

    for (var i = 0; i < links.length; ++i) {
      let link = links[i];
      if (link.classList.contains('status-link')) {
        continue;
      }
      link.classList.add('status-link');

      let mention = this.props.status.get('mentions').find(item => link.href === item.get('url'));

      if (mention) {
        link.addEventListener('click', this.onMentionClick.bind(this, mention), false);
        link.setAttribute('title', mention.get('acct'));
      } else if (link.textContent[0] === '#' || (link.previousSibling && link.previousSibling.textContent && link.previousSibling.textContent[link.previousSibling.textContent.length - 1] === '#')) {
        link.addEventListener('click', this.onHashtagClick.bind(this, link.text), false);
      } else {
        link.setAttribute('title', link.href);
        link.classList.add('unhandled-link');
      }

      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }

    if (this.props.status.get('collapsed', null) === null) {
      let collapsed =
          this.props.collapsable
          && this.props.onClick
          && node.clientHeight > MAX_HEIGHT
          && this.props.status.get('spoiler_text').length === 0;

      if(this.props.onCollapsedToggle) this.props.onCollapsedToggle(collapsed);

      this.props.status.set('collapsed', collapsed);
    }
  }

  _updateStatusEmojis () {
    const node = this.node;

    if (!node || autoPlayGif) {
      return;
    }

    const emojis = node.querySelectorAll('.custom-emoji');

    for (var i = 0; i < emojis.length; i++) {
      let emoji = emojis[i];
      if (emoji.classList.contains('status-emoji')) {
        continue;
      }
      emoji.classList.add('status-emoji');

      emoji.addEventListener('mouseenter', this.handleEmojiMouseEnter, false);
      emoji.addEventListener('mouseleave', this.handleEmojiMouseLeave, false);
    }
  }

  componentDidMount () {
    this._updateStatusLinks();
    this._updateStatusEmojis();
  }

  componentDidUpdate () {
    this._updateStatusLinks();
    this._updateStatusEmojis();
  }

  onMentionClick = (mention, e) => {
    if (this.context.router && e.button === 0 && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.context.router.history.push(`/accounts/${mention.get('id')}`);
    }
  }

  onHashtagClick = (hashtag, e) => {
    hashtag = hashtag.replace(/^#/, '');

    if (this.context.router && e.button === 0 && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.context.router.history.push(`/timelines/tag/${hashtag}`);
    }
  }

  handleEmojiMouseEnter = ({ target }) => {
    target.src = target.getAttribute('data-original');
  }

  handleEmojiMouseLeave = ({ target }) => {
    target.src = target.getAttribute('data-static');
  }

  handleMouseDown = (e) => {
    this.startXY = [e.clientX, e.clientY];
  }

  handleMouseUp = (e) => {
    if (!this.startXY) {
      return;
    }

    const [ startX, startY ] = this.startXY;
    const [ deltaX, deltaY ] = [Math.abs(e.clientX - startX), Math.abs(e.clientY - startY)];

    let element = e.target;
    while (element) {
      if (element.localName === 'button' || element.localName === 'a' || element.localName === 'label') {
        return;
      }
      element = element.parentNode;
    }

    if (deltaX + deltaY < 5 && e.button === 0 && this.props.onClick) {
      this.props.onClick();
    }

    this.startXY = null;
  }

  handleSpoilerClick = (e) => {
    e.preventDefault();

    if (this.props.onExpandedToggle) {
      // The parent manages the state
      this.props.onExpandedToggle();
    } else {
      this.setState({ hidden: !this.state.hidden });
    }
  }

  handleTranslationClick = (e) => {
    e.preventDefault();
    
    if (this.state.hideTranslation === true && this.state.translation === null) {
      const { status } = this.props;
      const content = status.get('content').length === 0 ? '' : htmlPare(status.get('content')).structuredText;

      let locale = getLocale()['localeData'][0]['locale']
      if (locale === 'zh') {
        const domLang = document.documentElement.lang
        locale = domLang === 'zh-CN' ? 'zh-cn' : 'zh-tw'
      }

      this.setState({ translationStatus: 'fetching' });
      axios({
        url:`/translate/`,
        method: 'get',
        params: {
          text: content === '' ? 'Nothing to translate' : content,
          to: locale
        }
      })
      .then(res => {
        console.log(res.data.text);
        this.setState({ 
          translation: res.data.text,
          translationStatus: 'succeed',
          hideTranslation: false,
         });
      })
      .catch((error) => {
        console.log(error);
        this.setState({ 
          translationStatus: 'failed',
          hideTranslation: true,
         });
      })
    } else {
      this.setState({ hideTranslation: !this.state.hideTranslation });
    }
  }

  setRef = (c) => {
    this.node = c;
  }

  render () {
    const { status } = this.props;

    if (status.get('content').length === 0) {
      return null;
    }

    const hidden = this.props.onExpandedToggle ? !this.props.expanded : this.state.hidden;
    const renderReadMore = this.props.onClick && status.get('collapsed');
    const renderViewThread = this.props.showThread && status.get('in_reply_to_id') && status.get('in_reply_to_account_id') === status.getIn(['account', 'id']);

    const content = { __html: status.get('contentHtml') };
    const spoilerContent = { __html: status.get('spoilerHtml') };
    const directionStyle = { direction: 'ltr' };
    const classNames = classnames('status__content', {
      'status__content--with-action': this.props.onClick && this.context.router,
      'status__content--with-spoiler': status.get('spoiler_text').length > 0,
      'status__content--collapsed': renderReadMore,
    });

    if (isRtl(status.get('search_index'))) {
      directionStyle.direction = 'rtl';
    }

    const showThreadButton = (
      <button className='status__content__read-more-button' onClick={this.props.onClick}>
        <FormattedMessage id='status.show_thread' defaultMessage='Show thread' />
      </button>
    );
    
    const toggleTranslation = !this.state.hideTranslation ? <FormattedMessage id='status.hide_translation' defaultMessage='Translate toot' /> : <FormattedMessage id='status.show_translation' defaultMessage='Hide translation' />;

    const readMoreButton = (
      <button className='status__content__read-more-button' onClick={this.props.onClick} key='read-more'>
        <FormattedMessage id='status.read_more' defaultMessage='Read more' /><Icon id='angle-right' fixedWidth />
      </button>
    );

    const translationContainer = (
      true ? 
        <React.Fragment>
          <button tabIndex='-1' className={`status__content__show-translation-button`} onClick={this.handleTranslationClick.bind(this)}>{toggleTranslation} <Icon id='language ' fixedWidth /></button>

          {/* error message */}
          <div className='translation-content__wrapper'>
            <section className={`translation-content__failed ${this.state.translationStatus === 'failed' ? 'display' : 'hidden'}`}>
              <p><FormattedMessage id='status.translation_failed' defaultMessage='Fetch translation failed' /></p>
            </section>
            <section className={`translation-content__loading ${this.state.translationStatus === 'fetching'? 'display' : 'hidden'}`}>
              <div className='spinner'><div></div><div></div><div></div><div></div></div>
              {/* <p>Fetching translation, please wait</p> */}
            </section>
            <section className={`translation-content__succeed ${this.state.translationStatus === 'succeed' && !this.state.hideTranslation ? 'display' : 'hidden'}`}>
              <p className='translation-content__powered-by'>
                <FormattedMessage id='status.translation_by' defaultMessage='Translation powered by {google}' 
                values={{
                  google: <a href='https://translate.google.com/' target='_blank'><img alt='Google' draggable='false' src={googleLogo} /></a>
                }}  />
              </p>
              <p className='translation-content'>{this.state.translation}</p>
            </section>
          </div>
        </React.Fragment> : null
    );

    if (status.get('spoiler_text').length > 0) {
      let mentionsPlaceholder = '';

      const mentionLinks = status.get('mentions').map(item => (
        <Permalink to={`/accounts/${item.get('id')}`} href={item.get('url')} key={item.get('id')} className='mention'>
          @<span>{item.get('username')}</span>
        </Permalink>
      )).reduce((aggregate, item) => [...aggregate, item, ' '], []);

      const toggleText = hidden ? <FormattedMessage id='status.show_more' defaultMessage='Show more' /> : <FormattedMessage id='status.show_less' defaultMessage='Show less' />;

      if (hidden) {
        mentionsPlaceholder = <div>{mentionLinks}</div>;
      }

      return (
        <div className={classNames} ref={this.setRef} tabIndex='0' style={directionStyle} onMouseDown={this.handleMouseDown} onMouseUp={this.handleMouseUp}>
          <p style={{ marginBottom: hidden && status.get('mentions').isEmpty() ? '0px' : null }}>
            <span dangerouslySetInnerHTML={spoilerContent} />
            {' '}
            <button tabIndex='0' className={`status__content__spoiler-link ${hidden ? 'status__content__spoiler-link--show-more' : 'status__content__spoiler-link--show-less'}`} onClick={this.handleSpoilerClick}>{toggleText}</button>
          </p>

          {mentionsPlaceholder}

          <div tabIndex={!hidden ? 0 : null} className={`status__content__text ${!hidden ? 'status__content__text--visible' : ''}`} style={directionStyle} dangerouslySetInnerHTML={content} />

          {!hidden ? translationContainer : null}

          {!hidden && !!status.get('poll') && <PollContainer pollId={status.get('poll')} />}

          {renderViewThread && showThreadButton}
        </div>
      );
    } else if (this.props.onClick) {
      const output = [
        <div className={classNames} ref={this.setRef} tabIndex='0' style={directionStyle} onMouseDown={this.handleMouseDown} onMouseUp={this.handleMouseUp} key='status-content'>
          <div className='status__content__text status__content__text--visible' style={directionStyle} dangerouslySetInnerHTML={content} />

          {translationContainer}

          {!!status.get('poll') && <PollContainer pollId={status.get('poll')} />}

          {renderViewThread && showThreadButton}
        </div>,
      ];

      if (renderReadMore) {
        output.push(readMoreButton);
      }

      return output;
    } else {
      return (
        <div className={classNames} ref={this.setRef} tabIndex='0' style={directionStyle}>
          <div className='status__content__text status__content__text--visible' style={directionStyle} dangerouslySetInnerHTML={content} />

          {translationContainer}

          {!!status.get('poll') && <PollContainer pollId={status.get('poll')} />}

          {renderViewThread && showThreadButton}
        </div>
      );
    }
  }

}
