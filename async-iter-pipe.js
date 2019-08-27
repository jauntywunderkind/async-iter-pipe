"use module"
import Defer from "p-defer"

export class AsyncIterPipeDoneError extends Error{
	constructor( asyncIterPipe){
		super("AsyncIterPipeDoneError")
		this.asyncIterPipe= asyncIterPipe
	}
}

const resolved= Promise.resolve()

export const Drop= Symbol.for( "async-iter-pipe:drop")

export class AsyncIterPipe{
	static DROP = Drop

	// note: falsy values commented out

	// state
	done= false
	//value= null
	reads= [] // reads from consumers pending new values
	writes= [] // writes from produce awaiting readers
	//ending= false // wrapping up but not done yet
	tail= resolved
	//map= null

	// stored
	onAbort= null

	// modes
	//produceAfterReturn= false
	//strictAsync= false

	constructor( opts){
		this.onAbort= ex=> this.throw( ex)
		this.readCount= 0
		this.writeCount= 0
		if( opts){
			if( opts.signal){
				this.signal= opts.signal
			}
			if( opts.produceAfterReturn){
				this.produceAfterReturn= true
			}
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
	set signal( signal){
		if( this.signal_){
			this.signal_.removeEventListener( this.onAbort)
		}
		this.signal_= signal
		signal.once( this.onAbort, { passive: true})
	}
	get signal(){
		return this.signal_
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
				if( this.map&& !this.producing){
					this.producing= true
					val= this.map( val)
					this.producing= false
					if( val=== Drop){
						continue
					}
					if( readPos>= this.reads.length){
						// map could have produced more values so recheck
						break
					}
				}
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
						Promise.resolve().then(()=> {
							this.value= this.endingValue
							delete this.endingValue
							this.ending.resolve({
								done: true,
								value: this.value
							})
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
		for await( let item of iterable|| []){
			this.produce( item)
		}
		if( close){
			this.return( close)
		}
	}

	_nextReturn( fn, value, done= false){
		value= fn? fn(): value
		// synchronous shortcut: no tracking, no resolving needed
		if( !this.tail&& !(value&& value.then)){
			this.value= value
			const
			  iter0= { done, value},
			  iter= this.strictAsync? Promise.resolve( iter0): iter0
			return iter
		}

		// await value & await tail, then set value & return it's IterationResult
		// wouldn't it be cool if?:
		//   a promise that can describe it's dependencies,
		//   have "progress" of getting's value then waiting for tail
		//   perhaps context-runner style resolution
		const
		  oldTail= this.tail,
		  got= (async ()=> { //IIFE
			value= await value
			if( oldTail){
				await oldTail
			}
			this.value= value
			return {
				done,
				value
			}
		  })()
		// set tail if we're doing that
		if( this.tail){
			this.tail= got
		}
		return got
	}
	next(){
		++this.readCount

		// use already produced writes
		// (if ending, flush these out!)
		if( !this.done&& this.writes&& this.writes.length){
			return this._nextReturn( null, this.writes.shift())
		}

		// already done, return so
		if( this.done|| this.ending){
			// done
			return this._nextReturn(()=> this.value, null, true)
		}

		// queue up a new pending read
		let pendingRead= Defer()
		this.reads.push( pendingRead)
		return this._nextReturn( null, pendingRead.promise)
	}
	/**
	* Signify that no further values will be forthcoming
	*/
	end(){
		this.ending= true
		return this.tail|| Promise.resolve()
	}
	/**
	* Stop allowing produce, and stop returning already produced values.
	* If 'produceAfterReturn' mode is set, produce will continue to fulfill already issues reads.
	*/
	return( value){
		delete this.writes

		if( this.reads&& this.reads.length=== 0){
			// clear already drained
			delete this.reads
		}

		if( this.reads){
			if( !this.produceAfterReturn){
				const err= new AsyncIterPipeDoneError( this)
				for( let read of this.reads|| []){
					read.reject( err)
				}
				delete this.reads
				this.done= true
				this.value= value
			}else{
				this.ending= Defer()
				this.endingValue= value
				return this.ending.promise
			}
		}else{
			this.done= true
			this.value= value
		}
		return {
			done: true,
			value
		}
	}
	/**
	* Immediately become done and reject and pending reads.
	*/
	throw( ex){
		if( !this.done){
			for( let read of this.reads|| []){
				read.reject( ex)
			}
			delete this.reads
			delete this.writes
		}
		throw ex
	}
	[ Symbol.iterator](){
		return this
	}
}
export {
	AsyncIterPipe as default,
	AsyncIterPipe as asyncIterPipe,
	AsyncIterPipeDoneError as asyncIterPipeDoneError,
	AsyncIterPipeDoneError as DoneException,
	AsyncIterPipeDoneError as doneException
}
