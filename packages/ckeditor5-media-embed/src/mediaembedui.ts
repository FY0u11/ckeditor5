/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

/**
 * @module media-embed/mediaembedui
 */

import { Plugin } from 'ckeditor5/src/core.js';
import { ButtonView, CssTransitionDisablerMixin, MenuBarMenuListItemButtonView, Dialog, View, InputView } from 'ckeditor5/src/ui.js';

import MediaFormView from './ui/mediaformview.js';
import MediaEmbedEditing from './mediaembedediting.js';
import mediaIcon from '../theme/icons/media.svg';
import type { LocaleTranslate, Locale } from 'ckeditor5/src/utils.js';
import type MediaRegistry from './mediaregistry.js';

/**
 * The media embed UI plugin.
 */
export default class MediaEmbedUI extends Plugin {
	/**
	 * @inheritDoc
	 */
	public static get requires() {
		return [ MediaEmbedEditing, Dialog ] as const;
	}

	/**
	 * @inheritDoc
	 */
	public static get pluginName() {
		return 'MediaEmbedUI' as const;
	}

	/**
	 * @inheritDoc
	 */
	public static override get isOfficialPlugin(): true {
		return true;
	}

	private _formView: MediaFormView | undefined;

	private _errorContainer: any;
	private _successContainer: any;
	private _progressContainer: any;

	/**
	 * @inheritDoc
	 */
	public init(): void {
		const editor = this.editor;

		editor.ui.componentFactory.add( 'mediaEmbed', () => {
			const t = this.editor.locale.t;
			const button = this._createDialogButton( ButtonView );

			button.tooltip = true;
			button.label = t( 'Insert media' );

			return button;
		} );

		editor.ui.componentFactory.add( 'menuBar:mediaEmbed', () => {
			const t = this.editor.locale.t;
			const button = this._createDialogButton( MenuBarMenuListItemButtonView );

			button.label = t( 'Media' );

			return button;
		} );
	}

	/**
	 * Creates a button for menu bar that will show media embed dialog.
	 */
	private _createDialogButton<T extends typeof ButtonView | typeof MenuBarMenuListItemButtonView>( ButtonClass: T ): InstanceType<T> {
		const editor = this.editor;
		const buttonView = new ButtonClass( editor.locale ) as InstanceType<T>;
		const command = editor.commands.get( 'mediaEmbed' )!;
		const dialogPlugin = this.editor.plugins.get( 'Dialog' );

		buttonView.icon = mediaIcon;

		buttonView.bind( 'isEnabled' ).to( command, 'isEnabled' );

		buttonView.on( 'execute', () => {
			if ( dialogPlugin.id === 'mediaEmbed' ) {
				dialogPlugin.hide();
			} else {
				this._showDialog();
			}
		} );

		return buttonView;
	}

	private _showDialog() {
		const editor = this.editor;
		const dialog = editor.plugins.get( 'Dialog' );
		const command = editor.commands.get( 'mediaEmbed' )!;
		const t = editor.locale.t;

		if ( !this._formView ) {
			const registry = editor.plugins.get( MediaEmbedEditing ).registry;

			this._formView = new ( CssTransitionDisablerMixin( MediaFormView ) )( getFormValidators( editor.t, registry ), editor.locale );
			this._formView.on( 'submit', () => this._handleSubmitForm() );
		}

		const customView = new class extends View {
			constructor( locale: Locale, mediaFormView: MediaFormView ) {
				super( locale );

				this.setTemplate( {
					tag: 'div',

					children: [
						mediaFormView,
						new class extends View {
							constructor( locale: Locale ) {
								super( locale );

								this.setTemplate( {
									tag: 'div',
									attributes: {
										id: 'local-video-upload'
									}
								} );
							}
						}( locale )
					]
				} );
			}
		}( editor.locale, this._formView );

		dialog.show( {
			id: 'mediaEmbed',
			title: t( 'Insert media' ),
			content: customView,
			isModal: true,
			onShow: () => {
				this._formView!.url = command.value || '';
				this._formView!.resetFormStatus();
				this._formView!.urlInputView.fieldView.select();
				const mediaConfig = editor.config.get( 'mediaEmbed' );
				this._renderLocalVideoUploader( mediaConfig );
			},
			actionButtons: [
				{
					label: t( 'Cancel' ),
					withText: true,
					onExecute: () => dialog.hide()
				},
				{
					label: t( 'Accept' ),
					class: 'ck-button-action',
					withText: true,
					onExecute: () => this._handleSubmitForm()
				}
			]
		} );
	}

	private _renderLocalVideoUploader( config: any ) {
		const el = document.getElementById( 'local-video-upload' );
		const maxSizeInMb = config.videoMaxSizeInMb || 60;
		const videoFormats = config.videoFormats || [ 'video/mp4', 'video/webm' ];
		const videoUploadUrl = config.videoUploadUrl;
		const siteName = config.siteName || 'your website';
		const formatsText = videoFormats.map( ( v: string ) => v.split( '/' )[ 1 ].toUpperCase() )
			.join( ', ' );

		const html = `
			<h3 class="ck ck-label">Or upload a video to the ${siteName}</h3>

			<input type="file" id="video-input" style="display: none;" accept="${videoFormats.join(',')}">
			<div style="margin-top: 5px; font-size: 0.75em; color: #333;">
				You can use the following video formats: ${formatsText}. Maximum file size is ${maxSizeInMb}MB.
			</div>

			<div class="local-video-uploader__progress-container"
				style="display: none; width: 100%; margin-top: 10px; background: #eee; padding: 5px; border-radius: 5px;">
				<div style="width: 0%; height: 20px; background: #4caf50; text-align: center; color: white; border-radius: 5px;">0%</div>
			</div>

			<div style="display: none; margin-top: 10px; font-size: 0.75em; color: #d60a0a;"
				 class="local-video-uploader__error-container">
			</div>

			<div style="display: none; margin-top: 10px; font-size: 0.75em; color: #199237;"
				 class="local-video-uploader__success-container">
			</div>

			<button class="ck ck-button ck-button-action" style="margin-top: 10px">Upload a video</button>
		`;

		if ( !el ) {
			return;
		}

		el.style.padding = '12px 12px 20px 12px';
		el.innerHTML = html;

		const uploadBtn = el.querySelector( 'button' );

		if ( !uploadBtn ) {
			return;
		}

		const fileInput: HTMLInputElement | null = el.querySelector( 'input[type="file"]' );

		if ( !fileInput ) {
			return;
		}

		this._errorContainer = el.querySelector( '.local-video-uploader__error-container' );
		if ( !this._errorContainer ) {
			return;
		}

		this._successContainer = el.querySelector( '.local-video-uploader__success-container' );
		if ( !this._successContainer ) {
			return;
		}

		this._progressContainer = el.querySelector( '.local-video-uploader__progress-container' );
		if ( !this._progressContainer ) {
			return;
		}

		if ( !videoUploadUrl ) {
			this._showError( 'The video upload URL is not provided in the CKEditor config.' );

			return;
		}

		uploadBtn.addEventListener( 'click', () => {
			this._hideError();
			this._hideSuccess();
			this._hideProgress();
			fileInput.value = '';
			fileInput.click();
		} );

		fileInput.addEventListener( 'change', () => {
			if ( !fileInput.files || !fileInput.files.length ) {
				return;
			}

			const file = fileInput.files[ 0 ];

			if ( !file ) {
				return;
			}

			if ( !videoFormats.includes( file.type ) ) {
				this._showError( 'Invalid file type. Please upload a video file.' );

				return;
			}

			const maxSizeInKb = maxSizeInMb * 1024 * 1024; // 60MB
			if ( file.size > maxSizeInKb ) {
				this._showError( `File size exceeds the ${ maxSizeInMb }MB limit.` );

				return;
			}

			this._uploadVideoInChunks( config, file );
		} );
	}

	private _showError( text: string ) {
		this._errorContainer.style.display = 'block';
		this._errorContainer.innerHTML = text;
	}

	private _showSuccess( text: string ) {
		this._successContainer.style.display = 'block';
		this._successContainer.innerHTML = text;
	}

	private _showProgress() {
		this._progressContainer.style.display = 'block';
	}

	private _hideError() {
		this._errorContainer.style.display = 'none';
	}

	private _hideSuccess() {
		this._successContainer.style.display = 'none';
	}

	private _hideProgress() {
		this._progressContainer.style.display = 'none';
	}

	private async _uploadVideoInChunks( config: any, file: any ) {
		const chunkSizeInMb = config.videoChunkSizeInMb || 5;
		const chunkSize = chunkSizeInMb * 1024 * 1024;
		const totalChunks = Math.ceil( file.size / chunkSize );
		const apiUrl = config.videoUploadUrl;
		const urlPlaceholder = config.videoUrlPlaceholder;
		const csrfToken = config.csrfToken || null;
		const apiKey = config.videoUploadKey || null;
		let start = 0;
		let chunkIndex = 0;
		const maxAttempts = 3;
		const progressBar = this._progressContainer.querySelector( 'div:first-child' );
		if ( !progressBar ) {
			return;
		}
		progressBar.style.width = '0%';
		this._showProgress();
		const fileNameSplitted = file.name.split( '.' );
		const extension = fileNameSplitted[ fileNameSplitted.length - 1 ];
		const filename = this._base62( Math.trunc( Math.random() * 1e10 ) ) +
			this._base62( Date.now() ) + `.${ extension }`;

		while ( start < file.size ) {
			const chunk = file.slice( start, start + chunkSize );
			const formData = new FormData();
			formData.append( 'file', chunk );
			formData.append( 'chunkIndex', String( chunkIndex ) );
			formData.append( 'totalChunks', String( totalChunks ) );
			formData.append( 'fileName', filename );
			formData.append( '_token', csrfToken );
			formData.append( '_key', apiKey );

			let attempts = 0;
			let success = false;
			while ( attempts < maxAttempts && !success ) {
				try {
					const response = await fetch( apiUrl, {
						method: 'POST',
						body: formData
					} );

					if ( !response.ok ) {
						throw new Error( `Chunk ${ chunkIndex } upload failed` );
					}

					success = true;
				} catch ( error ) {
					attempts++;
					this._showError( `Attempt ${ attempts } failed for chunk ${ chunkIndex }:` );
					if ( attempts === maxAttempts ) {
						this._showError( `Chunk ${ chunkIndex } failed after ${ maxAttempts } attempts.` );
						return;
					}
				}
			}

			start += chunkSize;
			chunkIndex++;

			const progressPercent = Math.round( ( chunkIndex / totalChunks ) * 100 );
			progressBar.style.width = `${ progressPercent }%`;
			progressBar.innerText = `${ progressPercent }%`;
		}

		this._hideProgress();
		this._showSuccess( 'Video successfully uploaded' );

		this._formView!.url = urlPlaceholder.replace('{slug}', filename);

		setTimeout( () => {
			this._handleSubmitForm();
		}, 1000 );
	}

	private _base62( num: number ): string {
		const index = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
		let result = '';
		do {
			result = index[ num % 62 ] + result;
			num = Math.trunc( num / 62 );
		} while ( num );

		return result;
	}

	private _handleSubmitForm() {
		const editor = this.editor;
		const dialog = editor.plugins.get( 'Dialog' );

		if ( this._formView!.isValid() ) {
			editor.execute( 'mediaEmbed', this._formView!.url );
			dialog.hide();
			editor.editing.view.focus();
		}
	}
}

function getFormValidators( t: LocaleTranslate, registry: MediaRegistry ): Array<( v: MediaFormView ) => string | undefined> {
	return [
		form => {
			if ( !form.url.length ) {
				return t( 'The URL must not be empty.' );
			}
		},
		form => {
			if ( !registry.hasMedia( form.url ) ) {
				return t( 'This media URL is not supported.' );
			}
		}
	];
}
