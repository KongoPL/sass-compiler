// Requires:
// @parameter string sass file or directory
// @parameter out directory or out file name

var fs = require("fs");
var chokidar = require("chokidar");
var exec = require( 'child_process' ).exec;
var lastModTimes = {};


function isDir(path)
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

if(typeof process.argv[2] !== "string" || typeof process.argv[3] !== "string")
{
	console.error("Usage:");
	console.error("watch-file <sass filename or directory> <out directory or filename> [just-compile] [prod]");
}
else
{
	var sourceFileNameOrDirectory = __dirname + "/" + process.argv[2];
	var outFileNameOrDirectory = __dirname + "/" + process.argv[3];
	var justCompile = (process.argv[4] == "just-compile" || process.argv[5] == "just-compile" ? true:false);
	var isProduction = (process.argv[4] == "prod" || process.argv[5] == "prod" ? true:false);
	var isSourceDirectory = isDir(sourceFileNameOrDirectory);

	if(justCompile == false)
	{
		chokidar.watch(sourceFileNameOrDirectory, {
			/*ignored: function(path, stats)
			{
				path = path.replace(/\\/g, "/");

				let pathParts = path.split("/");
				let fileName = pathParts[pathParts.length - 1];

				return (/^_.*?\.scss$/).test(fileName); //Ignore all _*.scss files
			}*/
		}).on('change', function(path)
		{
			//console.log(path);
			reCompileFiles();
		});
	}

	reCompileFiles();
}

function reCompileFiles()
{
	var filesToCompile = [],
		outFilesPaths = [];

	if(isSourceDirectory)
	{
		filesToCompile = getDirectoryFiles(sourceFileNameOrDirectory, /^.*?\.scss/);

		for ( let i = 0; i < filesToCompile.length; )
		{
			let sourcePath = filesToCompile[i];
			let outPath = getDestinationFilePath( sourcePath );
			let lastModDateSource = fs.statSync( sourcePath );

			if ( typeof lastModTimes[sourcePath] == "undefined" || lastModDateSource.mtimeMs > lastModTimes[sourcePath] )
			{
				outFilesPaths.push( outPath );

				lastModTimes[sourcePath] = lastModDateSource.mtimeMs;
				i++;
			}
			else
			{
				filesToCompile.splice( i, 1 );
			}
		}
	}
	else
	{
		filesToCompile.push(sourceFileNameOrDirectory);
		outFilesPaths.push(outFileNameOrDirectory);
	}

	/*console.log(filesToCompile);
	console.log( outFilesPaths);
	return;*/

	if(filesToCompile.length > 0)
	{
		compileFilesSync(filesToCompile, outFilesPaths);
	}
}


function getDestinationFilePath(sourcePath)
{
	return sourcePath.replace(sourceFileNameOrDirectory, outFileNameOrDirectory).replace(/\.scss$/, ".css");
}


function getDirectoryFiles(directoryPath, fileNameMask)
{
	if(fileNameMask === undefined) fileNameMask = new RegExp("^.*?$");

	var files = [];
	var dirFiles = fs.readdirSync(directoryPath);

	for(let c in dirFiles)
	{
		let filename = dirFiles[c];
		let file = directoryPath + "/" + filename;
		let isDirectory = isDir(file);

		if(isDirectory == false && filename.substr(0, 1) == '_' || filename.indexOf('~') > -1)
			continue; //Excluded from compile by sass docs or Visual Studio temp file

		if(isDirectory)
		{
			let subfiles = getDirectoryFiles(file, fileNameMask);

			for(let d in subfiles)
			{
				files.push(subfiles[d]);
			}
		}
		else
		{
			if(fileNameMask.test(filename))
			{
				files.push(file);
			}
		}
	}


	return files;
}

function getDirectoryDirectories(directoryPath)
{
	var directories = [];
	var dirFiles = fs.readdirSync(directoryPath);

	for(let c in dirFiles)
	{
		let filename = dirFiles[c];
		let path = directoryPath + "/" + filename;
		let isDirectory = isDir(path);

		if(isDirectory)
		{
			directories.push(path);

			let subdirs = getDirectoryDirectories(path);

			for(let d in subdirs)
			{
				directories.push(subdirs[d]);
			}
		}
	}


	return directories;
}

function compileFilesSync(sourcePaths, outPaths)
{
	let i = 0;
	let output = '';
	let compiledFilesString = '';

	for ( let c in sourcePaths )
	{
		compiledFilesString += sourcePaths[c] + "\n";
	}

	console.log( "Compilation in progress..." );
	let start = new Date().getTime();


	let loadCallback = (function(e, out, err)
	{
		if(out != '')
			output += out+"\n";

		if(err != '')
			output += err+"\n";

		i++;

		if(sourcePaths.length > i)
		{
			compileFile(sourcePaths[i], outPaths[i], loadCallback);
		}
		else
		{
			let end = new Date().getTime()

			console.clear();
			console.log( "Compiled in " + ( (end - start) / 1000 ) + "s!" );
			console.log( "Last compile: " + ( new Date() ) );

			console.log( "Compiled files:" );
			console.log( compiledFilesString );

			if(output != '')
			{
				console.error("Compile output:");
				console.error(output);
			}

			console.log("Waiting for changes...");
		}
	});

	compileFile(sourcePaths[0], outPaths[0], loadCallback);
}

function compileFile(sourceFileName, outFileName, callback)
{
	exec('sass "'+sourceFileName+'" "'+outFileName+'"'+(isProduction ? " --no-source-map" : ''), callback);
}