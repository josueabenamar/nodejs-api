function init(path)
{
	var config = require(path + '/config');
	var logger = require('./logger').get(config);
	var cluster = require('cluster');


	if(cluster.isMaster)
	{
		var os = require('os');
		var cpus = config.cpus ? config.cpus : os.cpus().length;

		for(var child = 0; child < cpus; child++)
		{
			cluster.fork();
		}

		cluster.on('exit', function(worker, code, signal)
		{
			logger.pid(worker.process.pid);
			logger.info("worker down");

			cluster.fork();
		});
	}
	else
	{
		var app = config.app ? config.app : 'app';
		var port = config.port ? config.port : 5000;

		var express = require('express');
		var bodyparser = require('body-parser');

		var server = express();
		server.use(bodyparser.urlencoded({extended: false}));
		server.use(bodyparser.json());
		server.use(function(req, res, next)
		{
			res.header('Access-Control-Allow-Origin', '*');
			res.header('Access-Control-Allow-Methods', 'POST, GET');
			res.header('Access-Control-Allow-Headers', 'Origin, Authorization, X-Requested-With, Content-Type, Accept');
			next();
		});

		logger.pid(cluster.worker.process.pid);
		logger.info("server init");

		var callback = function(error)
		{
			if(error)
			{
				logger.error(error);
				process.exit(1);
			}

			logger.info("server started at port " + port);
		};

		if(config.ssl && config.ssl.enabled)
		{
			var fs = require('fs');
			var https = require('https');

			var options =
			{
				key: fs.readFileSync(config.ssl.key),
				cert: fs.readFileSync(config.ssl.cert)
			};

			https.createServer(options, server).listen(port, callback);
		}
		else
		{
			server.listen(port, callback);
		}

		var api = require('./api');
		api.init(server, path + '/' + app);

		logger.info("worker up");
	}
}

module.exports.init = init;