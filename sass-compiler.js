// Requires:
// @parameter string sass file or directory
// @parameter out directory or out file name

const VERSION = `1.01`;
	fs = require( "fs" ),
	chokidar = require( "chokidar" ),
	exec = require( 'child_process' ).exec,
	pathIsAbsolute = require( 'path-is-absolute' ),
	yargs = require( 'yargs' );

class SassCompiler
{
	static init()
	{
		this.options = {
			// Required:
			inputPath: false,
			outputPath: false,

			// Optional:
			watch: true,
			isProduction: false,
			includePath: []
		};

		this._fileModificationTimes = {};

		this.__loadOptions( process.argv );
		this.__displayVersion();

		//console.log( this.options ); return;

		// Validate:
		if ( !this.options.inputPath || !this.options.outputPath && this.options.inputPath == this.options.outputPath )
			this._displayHelp();
		else
		{
			if ( this.options.watch )
				chokidar.watch( this.options.inputPath ).on( 'change', this._runCompilationProcess.bind( this ) );

			this._runCompilationProcess();
		}
	}


	static __loadOptions()
	{
		this.options = { ...this.options, ...yargs.argv };

		if ( 0 in yargs.argv._ )
			this.options.inputPath = yargs.argv._[0];

		if ( 1 in yargs.argv._ )
			this.options.outputPath = yargs.argv._[1];

		if ( this.options.inputPath && !pathIsAbsolute( this.options.inputPath ) )
			this.options.inputPath = __dirname + "/" + this.options.inputPath;

		if ( this.options.outputPath && !pathIsAbsolute( this.options.outputPath ) )
			this.options.outputPath = __dirname + "/" + this.options.outputPath;

		if ( typeof this.options.includePath != 'object' )
			this.options.includePath = [this.options.includePath];
 	}


	static __displayVersion()
	{
		console.log( `Sass compiler v. ${VERSION}` );
		console.log( "Created by Jakub Poliszuk\n" );
	}


	static _displayHelp()
	{
		console.log( "Usage:" );
		console.log( "sass-utils.js <sass filename or directory> <out directory or filename> [options]" );
		console.log();
		console.log( "Available options:" );
		console.log( `	--inputPath=<PATH>		Input file or directory` );
		console.log( `	--outputPath=<PATH>		Output file or directory` );
		console.log( `	--[no-]watch			Watches for changes in files` );
		console.log( `	--[no-]isProduction		Compile file(s) as for production (no source maps)` );
		console.log( `	--includePath=<PATH> 		A path to use when resolving imports.` );
		console.log( `				 	May be passed multiple times.` );
	}


	static _runCompilationProcess()
	{
		const filesToCompile = this.__getFilesToCompile();

		if ( filesToCompile.length > 0 )
		{
			const compiledFilesString = filesToCompile.join( "\n" ),
				compilationStart = new Date().getTime(),
				outputFilesPaths = filesToCompile.map( this._getDestinationFilePath.bind( this ) );

			console.log( "Compilation in progress..." );

			this._compileFiles( filesToCompile, outputFilesPaths ).then( compilerOutput =>
			{
				const compilationEnd = new Date().getTime();

				console.clear();
				console.log( "Compiled in " + ( ( compilationEnd - compilationStart ) / 1000 ) + "s!" );
				console.log( "Last compile: " + ( new Date() ) );

				console.log( "Compiled files:" );
				console.log( compiledFilesString );

				if ( compilerOutput != '' )
				{
					console.error( "Compile output:" );
					console.error( output );
				}

				console.log( "Waiting for changes..." );
			} );
		}
	}


	static __getFilesToCompile()
	{
		const filesToCompile = [];

		if ( this._isDir( this.options.inputPath ) )
		{
			filesToCompile.push( ...this.__getStyleFiles( this.options.inputPath ) );

			for ( let i = 0; i < filesToCompile.length; )
			{
				const sourcePath = filesToCompile[i],
					lastModDateSource = fs.statSync( sourcePath );

				if ( sourcePath in this._fileModificationTimes && this._fileModificationTimes[sourcePath] >= lastModDateSource.mtimeMs )
					filesToCompile.splice( i, 1 );
				else
				{
					this._fileModificationTimes[sourcePath] = lastModDateSource.mtimeMs;
					i++;
				}
			}
		}
		else
			filesToCompile.push( this.options.inputPath );


		return filesToCompile;
	}


	static _isDir( path )
	{
		try
		{
			return fs.lstatSync( path ).isDirectory();
		}
		catch ( e )
		{
			return false;
		}
	}


	static __getStyleFiles( directoryPath )
	{
		const styleFiles = [],
			dirFiles = fs.readdirSync( directoryPath );

		for ( let fileName of dirFiles )
		{
			const filePath = directoryPath + "/" + fileName;

			if ( this._isDir( filePath ) )
				styleFiles.push( ...this.__getStyleFiles( filePath ) );
			else if ( ( /^(?!_.*$)[^~]+\.scss$/ ).test( fileName ) )
				styleFiles.push( filePath );
		}

		return styleFiles;
	}


	static _getDestinationFilePath( sourcePath )
	{
		if ( this._isDir( this.options.inputPath ) )
			return sourcePath.replace( this.options.inputPath, this.options.outputPath ).replace( /\.scss$/, ".css" );
		else
			return this.options.outputPath;
	}


	static _compileFiles( sourcePaths, outPaths )
	{
		return new Promise( ( resolve, reject ) =>
		{
			let i = 0,
				output = '';

			const compileCallback = ( e, out, err ) =>
			{
				if ( out != '' )
					output += out + "\n";

				if ( err != '' )
					output += err + "\n";

				i++;

				if ( i in sourcePaths )
					this._compileFile( sourcePaths[i], outPaths[i], compileCallback );
				else
					resolve( output );
			};

			this._compileFile( sourcePaths[0], outPaths[0], compileCallback );
		} );
	}


	static _compileFile( sourceFileName, outFileName, callback )
	{
		const options = ( this.options.isProduction ? " --no-source-map" : '' ) +
			( this.options.includePath.length > 0 ? ' --load-path="' + this.options.includePath.join( '" --load-path="' ) + '"' : '' );

		exec( 'sass "' + sourceFileName + '" "' + outFileName + '"' + options, callback );
	}
}

SassCompiler.init();