/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

/* globals DecoupledEditor, MiniCKEditorInspector, Essentials, console, window, document */

function CustomHeading( editor ) {
	editor.model.schema.register( 'heading', {
		allowAttributes: [ 'level' ],
		inheritAllFrom: '$block'
	} );

	editor.conversion.elementToElement( {
		model: 'heading',
		view: 'h1'
	} );
}

DecoupledEditor.create( document.querySelector( '#mini-inspector-heading' ), {
	plugins: [ Essentials, CustomHeading ],
	toolbar: [],
	licenseKey: 'GPL'
} )
	.then( editor => {
		window.editor = editor;

		MiniCKEditorInspector.attach(
			editor,
			document.querySelector( '#mini-inspector-heading-container' )
		);
	} )
	.catch( err => {
		console.error( err.stack );
	} );
