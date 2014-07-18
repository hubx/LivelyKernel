module('lively.lang.VM').requires().toRun(function() {

Object.extend(lively.lang.VM, {

    transformForVarRecord: function(code, varRecorder, varRecorderName) {
        // variable declaration and references in the the source code get
        // transformed so that they are bound to `varRecorderName` aren't local
        // state. THis makes it possible to capture eval results, e.g. for
        // inspection, watching and recording changes, workspace vars, and
        // incrementally evaluating var declarations and having values bound later.
        try {
            var transformed = lively.ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(
                code, {name: varRecorderName, type: "Identifier"},
                {ignoreUndeclaredExcept: Object.keys(varRecorder)});
            code = transformed.source;
        } catch(e) {
            if (lively.Config.showImprovedJavaScriptEvalErrors) $world.logError(e)
            else console.error("Eval preprocess error: %s", e.stack || e);
        }
        return code;
    },

    transformSingleExpression: function(code) {
        // evaling certain expressions such as single functions or object
        // literals will fail or not work as intended. When the code being
        // evaluated consists just out of a single expression we will wrap it in
        // parens to allow for those cases
        try {
            var ast = lively.ast.acorn.fuzzyParse(code);
            if (ast.body.length === 1 &&
               (ast.body[0].type === 'FunctionDeclaration' 
             || ast.body[0].type === 'BlockStatement')) {
                code = '(' + code.replace(/;\s*$/, '') + ')';
            }
        } catch(e) {
            if (lively.Config.showImprovedJavaScriptEvalErrors) $world.logError(e)
            else console.error("Eval preprocess error: %s", e.stack || e);
        }
        return code;
    },

    getGlobal: function() {
        return (function() { return this; })();
    },

    _eval: function(__lvEvalStatement, __lvVarRecorder/*needed as arg for capturing*/) {
        return eval(__lvEvalStatement);
    },

    runEval: function (code, options, thenDo) {
        // the main function where all eval options are configured
        if (typeof options === 'function' && arguments.length === 2) {
            thenDo = options; options = {};
        } else if (!options) options = {};
        
        var vm = lively.lang.VM, result, err,
            context = options.context || vm.getGlobal(),
            recorder = options.topLevelVarRecorder;

        if (recorder) code = vm.transformForVarRecord(code, recorder, '__lvVarRecorder');
        code = vm.transformSingleExpression(code);

        $morph('log') && ($morph('log').textString = code);

        try {
            result = vm._eval.call(context, code, recorder);
        } catch (e) { err = e; } finally { thenDo(err, result); }
    },

    syncEval: function(string, options) {
        // Although the defaul eval is synchronous we assume that the general
        // evaluation might not return immediatelly. This makes is possible to
        // change the evaluation backend, e.g. to be a remotely attached runtime
        var result;
        lively.lang.VM.runEval(string, options, function(e, r) { result = e || r; });
        return result;
    }

});

}); // end of module