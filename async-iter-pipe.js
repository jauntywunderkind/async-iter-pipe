"use module"
import Defer from "p-defer"

export class AsyncIterPipeAbortError extends Error{
	constructor( asyncIterPipe){
		super("AsyncIterPipeDoneError")
		this.asyncIterPipe= asyncIterPipe
	}
}

const resolved= Promise.resolve()

// public facing symbols
export const Drop= Symbol.for( "async-iter-pipe:drop")

// internal symbols
export const
  _controller= Symbol.for( "async-iter-pipe:_controller"),
  _doneSignal= Symbol.for( "async-iter-pipe:_doneSignal"),
  _abortSignal= Symbol.for( "async-iter-pipe:_abortSignal")

export const controllerSignals= {
	[{ name: "abort", test: "aborted"}]
}

export const listenerBinding= {
	passive: true,
	once: true
}

let n= 0

export class AsyncIterPipe{
	static DROP = Drop
	static get [ Symbol.species](){
		return Promise
	}
	static get controllerSignals(){ return controllerSignals}
	static get listenerBinding(){ return listenerBinding}

	// note: falsy values commented out

	// state
	done= false
	//value= null
	reads= [] // reads from consumers pending new values
	writes= [] // writes from produce awaiting readers
	//ending= false // wrapping up but not done yet
	tail= resolved
	//map= null

	readCount= 0
	writecont= 0

	[ _doneSignal]= Defer()

	// modes
	////produceAfterReturn= false
	//strictAsync= false

	constructor( opts){
		if( opts){
			if( opts.controller){
				this.signal= opts.controller.signal
			}
			//if( opts.produceAfterReturn){
			//	this.produceAfterReturn= true
			//}
			if( opts.tail|| opts.sloppy){
				this.tail= opts.tail|| null
			}
			if( opts.strictAsync){
				this.strictAsync= true
			}
			if( opts.map){
				this.map= opts.map
			}
		}
	}
	/**
	* Return number of stored write values ready to consume,
	* or if negative, the number of read values pending
	*/
	get queueCount(){
		if( this.writes&& this.writes.length){
			return this.writes.length
		}else if( this.reads&& this.reads.length){
			return -this.reads.length
		}else{
			return 0
		}
	}

	/**
	* Fill any outstanding reads, then save further produced values
	*/
	produce( ...vals){
		//console.log( "pipe-produce", this.done, this.reads)
		// cannot produce if done
		if( this.done&& !this.reads){
			throw new AsyncIterPipeDoneError( this)
		}

		// resolve as many outstanding reads as we can
		let valPos= 0
		if( this.reads){
			let readPos= 0
			for( ; valPos< vals.length&& readPos< this.reads.length; ++valPos){
				let val= vals[ valPos]

				// old mode where a map function could produce additional values
				//if( this.map&& !this.producing){
				//	this.producing= true
				//	val= this.map( val)
				//	this.producing= false
				//	if( val=== Drop){
				//		continue
				//	}
				//	if( readPos>= this.reads.length){
				//		// map could have produced more values so recheck
				//		break
				//	}
				//}

				// resolve
				++this.writeCount
				this.reads[ readPos++].resolve( val)
			}
			// remove these now satisfied reads
			if( valPos> 0){
				this.reads.splice( 0, valPos)
			}

			if( valPos=== vals.length){
				// vals are gone!
				if(( this.done|| this.ending)&& this.reads.length=== 0){
					// cleanup, no more reads coming
					delete this.reads
					this.done= true
					if( this.ending){
						queueMicrotask(()=> {
							this.value= this.endingValue
							delete this.endingValue
							if( this.ending&& this.ending.resolve){
								this.ending.resolve({
									done: true,
									value: this.value
								})
							}
						})
					}
				}
				return
			}
		}

		if( this.ending){
			throw new AsyncIterPipeDoneError( this)
		}

		// save remainder into outstanding writes
		for( ; valPos< vals.length; ++valPos){
			let val= vals[ valPos]
			if( this.map&& !this.producing){
				this.producing= true
				val= this.map( vals[ valPos])
				this.producing= false
				if( val=== Drop){
					continue
				}
			}
			++this.writeCount
			this.writes.push( val)
		}
	}
	async produceFrom( iterable, close= false){
		//console.log( "pipe-produceFrom")
		for await( let item of iterable|| []){
			this.produce( item)
		}
		if( close){
			this.return( close)
		}
	}

	_nextReturn( fn, value){
		//console.log( "pipe-_nextReturn")
		value= fn? fn(): value
		const isPromise= value&& value.then

		// synchronous shortcut: no tracking, no resolving needed
		if( !this.tail&& !isPromise){
			this.value= value
			const
			  iter0= { done, value},
			  iter= this.strictAsync? Promise.resolve( iter0): iter0
			return iter
		}

		if( this.tail){
			this.tail= this.tail.then( function(){
				this.value= value
				return value
			})
		
			return this.tail
		}
		return value
	}
	next(){
		//console.log( "pipe-next")
		++this.readCount

		// use already produced writes
		// (if ending, flush these out!)
		const hadWrites= this.writes&& this.writes.length
		if( !this.done&& hadWrites){
			//console.log( "pipe-next-had-writes")
			return this._nextReturn( null, this.writes.shift())
		}

		// already done, return so
		if( this.done|| this.ending){
			//console.log( "pipe-next-already-done")
			// done
			return this._nextReturn(()=> this.value, null, true)
		}

		// queue up a new pending read
		let pendingRead= Defer()
		this.reads.push( pendingRead)
		//console.log( "pipe-next-reads-"+ this.reads.length)
		return this._nextReturn( null, pendingRead.promise)
	}

	_end( value, error){
		const reads= this.reads
		delete this.reads
		delete this.writes

		this.done= true
		this.value= value
		this.error= error
		this[ _doneSignal].resolve()

		return {
			done: true,
			value
		}
	}

	/**
	* Stop allowing produce, and stop returning already produced values.
	* If 'produceAfterReturn' mode is set, produce will continue to fulfill already issues reads.
	*/
	return( value){
		return this._end( value)
	}
	/**
	* Immediately become done and reject and pending reads.
	*/
	throw( ex){
		return this._end( undefined, ex)
	}
	[ Symbol.iterator](){
		return this
	}
	[ Symbol.asyncIterator](){
		return this
	}


	get done(){
		if( !this[ _doneSignal]){
			this[ _doneSignal]= Defer()
		}
		return this[ _doneSignal].promise
	}
	get aborted(){
		if( !this[ _abortSignal]){
			this[ _abortSignal]= Defer()
		}
		return this[ _abortSignal].promise
	}

	_abortListener(){
		
	}

	get controller(){
		return this[ _controller]
	}
	set controller( controller){
		const oldController= this[ _controller]
		if( controller== oldController){
			return
		}
		for( const signal of (this.controllerSignals|| this.constructor.controllerSignals)){
			// get our listener
			const
			  listenerName= `_${signal.name}Listener`,
			  binding= signal.binding|| (this.listenerBinding|| this.constructor.listenerBinding)
			let listener= this[ listenerName]
			if( !listener){
				continue
			}
			// insure listener is bound
			if( listener=== this.constructor.prototype[ listenerName]){
				listener= this[ listenerName]= listener.bind( this)
			}
			// stop listening for old signals
			if( oldController){
				oldController.removeEventListener( signal, listener, binding)
			}
			// listen for signals
			if( controller){
				controller.addEventListener( signal, listener, binding)
			}
			// controller might already have signalled
			if( controller[ signal.test]){
				listener()
			}
		}
	}
	_abortListener(){
		// end
		const reads= this.reads
		delete this.reads
		this.aborted= true
		this._end()

		// signal aborts
		const err= new AsyncIterPipeAbortError()
		for( const read in reads|| []){
			read.reject( err)
		}
	}
}
export {
	AsyncIterPipe as default,
	AsyncIterPipe as asyncIterPipe,
	AsyncIterPipe as Pipe,
	AsyncIterPipe as pipe,
	AsyncIterPipeAbortError as asyncIterPipeAbortError,
	AsyncIterPipeAbortError as AbortException,
	AsyncIterPipeAbortError as abortException
}
